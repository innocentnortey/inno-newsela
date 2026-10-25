import type { Clock } from "@ls/core/ports/clock";
import type { CheckQueue } from "@ls/core/ports/check-queue";
import type { LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { IssueRepo } from "@ls/core/ports/issues";
import type { AlignmentRepo } from "@ls/core/ports/alignment";
import type { LessonGraphRepo } from "@ls/core/ports/lesson-graph";
import type { TxRunner } from "@ls/core/ports/tx";
import type { LessonId, Sha256 } from "@ls/core/ports/common";
import type { CheckContextLoader } from "@ls/core/checks/context-loader";
import { run_checks } from "@ls/core/checks/registry";
import type { CheckPolicy, CheckResult, CheckRuleList } from "@ls/core/checks/types";
import type { Logger } from "@ls/obs/logger";
import { RuleFailure } from "./rule-failure.ts";

// No lease setting exists; claim() hands out an expired lease again (AC-8).
export const CHECK_LEASE_MS = 30000;

export interface CheckRunReport {
  lesson_id: LessonId;
  content_hash: Sha256;
  blocking: number;
  confirmation: number;
  advisory: number;
  dependants_requeued: number;
  duration_ms: number;
}

// Claims one check job, checks the stored derived row, replaces issues and alignment links for
// that hash in one transaction, finishes the job and re-queues dependants. Holds no model client.
export class CheckJobRunner {
  constructor(
    private readonly checks: CheckQueue,
    private readonly reader: LessonDocReader,
    private readonly issues: IssueRepo,
    private readonly alignment: AlignmentRepo,
    private readonly graph: LessonGraphRepo,
    private readonly loader: Pick<CheckContextLoader, "load">,
    private readonly rules: CheckRuleList,
    private readonly policy: CheckPolicy,
    private readonly tx: TxRunner,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  /** null = nothing to report (queue empty, job skipped, or the run failed and will be retried at lease expiry). */
  async run_once(): Promise<CheckRunReport | null> {
    const claim = await this.checks.claim(CHECK_LEASE_MS);
    if (claim === null) return null;
    const { lesson_id, store_id } = claim;
    const started = this.clock.now();
    let hash: Sha256 = claim.content_hash;

    const derived = await this.reader.latest_derived(lesson_id);
    if (derived === null) {
      await this.checks.finish(claim);
      this.logger.info("check.skipped", { lesson_id, store_id, extra: { reason: "no_doc" } });
      return null;
    }
    if (derived.content_hash !== claim.content_hash) {
      const pending = await this.checks.pending_for(lesson_id);
      if (pending.newest_queued_hash !== null) {
        await this.checks.finish(claim);
        this.logger.info("check.skipped", { lesson_id, store_id, extra: { reason: "superseded" } });
        return null;
      }
    }
    hash = derived.content_hash;

    let result: CheckResult;
    let prev: Sha256 | null;
    try {
      prev = (await this.issues.current(lesson_id)).checked_hash;
      const ctx = await this.loader.load(lesson_id, derived.lesson, hash);
      result = run_checks(ctx, this.guarded(), this.policy);
      await this.tx.with_tx(async (t) => {
        await this.issues.replace_for_hash(lesson_id, hash, result.findings, t);
        await this.alignment.replace_for_hash(lesson_id, hash, result.alignment, t);
      });
    } catch (e) {
      // No finish: the lease expires and claim() hands the job out again. Never log e.message.
      this.logger.error("check.failed", {
        lesson_id,
        store_id,
        extra: {
          content_hash: hash,
          rule: e instanceof RuleFailure ? e.kind : null,
          name: e instanceof Error ? e.name : "unknown",
        },
      });
      return null;
    }

    await this.checks.finish(claim);

    let requeued = 0;
    if (prev !== hash) {
      for (const dep of await this.graph.dependants(lesson_id)) {
        const d = await this.reader.latest_derived(dep);
        if (d === null) continue;
        await this.tx.with_tx((t) => this.checks.enqueue(dep, d.content_hash, d.store_id as never, t));
        requeued += 1;
      }
    }

    const duration_ms = this.clock.now().getTime() - started.getTime();
    this.logger.info("check.done", {
      lesson_id,
      store_id,
      duration_ms,
      extra: {
        content_hash: hash,
        blocking: result.blocking,
        confirmation: result.confirmation,
        advisory: result.advisory,
        dependants_requeued: requeued,
      },
    });
    return {
      lesson_id,
      content_hash: hash,
      blocking: result.blocking,
      confirmation: result.confirmation,
      advisory: result.advisory,
      dependants_requeued: requeued,
      duration_ms,
    };
  }

  private guarded(): CheckRuleList {
    return this.rules.map((r) => ({
      kind: r.kind,
      level: r.level,
      run: (c, p) => {
        try {
          return r.run(c, p);
        } catch (e) {
          throw new RuleFailure(r.kind, e);
        }
      },
    }));
  }
}
