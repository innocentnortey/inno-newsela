import type { Clock } from "@ls/core/ports/clock";
import type { LessonId, Sha256 } from "@ls/core/ports/common";
import type { TxRunner } from "@ls/core/ports/tx";
import type { Logger } from "@ls/obs/logger";
import type { AdvisoryIssueWriter } from "./advisory-issue-writer.ts";
import type { JudgeRunReport } from "./judge-job.ts";

// NL-110. The judge lane: its own poll loop, no generation semaphore, no check-queue interaction. Advisory only.
export interface JudgeJobPort {
  run(lesson_id: LessonId, content_hash: Sha256): Promise<JudgeRunReport>;
}
export interface JudgeLoopReport {
  lesson_id: LessonId;
  content_hash: Sha256;
  pairs: number;
  verdicts_no: number;
  issues_written: number;
  skipped: number;
  failed: number;
}
export interface JudgeLoopOptions {
  poll_ms: number;
  backoff_ms: number;
  backoff_max_ms: number;
}
interface Q {
  query(text: string, values?: readonly unknown[]): Promise<{ rows: unknown[] }>;
}

// Latest hash of a lesson, already checked, with alignment links and no verdict rows. SKIP LOCKED lets a second claimant take another lesson.
const CLAIM_SQL = `
SELECT d.lesson_id, d.content_hash
  FROM lesson_doc d
 WHERE d.seq = (SELECT max(x.seq) FROM lesson_doc x WHERE x.lesson_id = d.lesson_id)
   AND EXISTS (SELECT 1 FROM alignment_link a WHERE a.lesson_id = d.lesson_id AND a.content_hash = d.content_hash)
   AND (EXISTS (SELECT 1 FROM check_job j WHERE j.lesson_id = d.lesson_id AND j.content_hash = d.content_hash AND j.status = 'done')
        OR EXISTS (SELECT 1 FROM issue i WHERE i.lesson_id = d.lesson_id AND i.content_hash = d.content_hash))
   AND NOT EXISTS (SELECT 1 FROM judge_verdict v WHERE v.lesson_id = d.lesson_id AND v.content_hash = d.content_hash)
 ORDER BY d.stored_at ASC, d.lesson_id ASC
 LIMIT 5
 FOR UPDATE OF d SKIP LOCKED`;

export class JudgeClaimLoop {
  readonly #backoff = new Map<string, { next_at: number; fails: number }>();

  constructor(
    private readonly db: TxRunner,
    private readonly job: JudgeJobPort,
    private readonly issues: AdvisoryIssueWriter,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly opts: JudgeLoopOptions,
  ) {}

  /** Claims at most one (lesson, hash), runs it, writes the advisory issues. null = nothing to do. */
  async run_once(): Promise<JudgeLoopReport | null> {
    return this.db.with_tx(async (tx) => {
      const rows = (await (tx as unknown as Q).query(CLAIM_SQL)).rows as { lesson_id: string; content_hash: string }[];
      const now = this.clock.now().getTime();
      const pick = rows.find((r) => (this.#backoff.get(`${r.lesson_id}|${r.content_hash}`)?.next_at ?? 0) <= now);
      if (pick === undefined) return null;
      const lesson_id = pick.lesson_id as LessonId;
      const content_hash = pick.content_hash as Sha256;
      const key = `${lesson_id}|${content_hash}`;
      let report: JudgeRunReport;
      try {
        report = await this.job.run(lesson_id, content_hash);
      } catch (e) {
        this.#fail(key);
        this.logger.error("judge.failed", { lesson_id, extra: { name: e instanceof Error ? e.name : "unknown", content_hash } });
        return null;
      }
      if (report.pairs > 0 && report.failed + report.skipped === report.pairs) {
        this.#fail(key);
        this.logger.warn("judge.unavailable", { lesson_id, extra: { content_hash, failed: report.failed, skipped: report.skipped } });
        return { lesson_id, content_hash, pairs: report.pairs, verdicts_no: 0, issues_written: 0, skipped: report.skipped, failed: report.failed };
      }
      if (report.failed + report.skipped > 0) {
        this.logger.warn("judge.partial", { lesson_id, extra: { content_hash, failed: report.failed, skipped: report.skipped } });
      }
      this.#backoff.delete(key);
      const nos = (
        await (tx as unknown as Q).query(
          "SELECT address, code, question FROM judge_verdict WHERE lesson_id=$1 AND content_hash=$2 AND verdict='no' ORDER BY address, code",
          [lesson_id, content_hash],
        )
      ).rows as { address: string; code: string; question: string }[];
      const issues_written = await this.issues.append_advisory(lesson_id, content_hash, nos);
      return { lesson_id, content_hash, pairs: report.pairs, verdicts_no: report.verdicts_no, issues_written, skipped: report.skipped, failed: report.failed };
    });
  }

  async run_until(stop: { is_set(): boolean }): Promise<{ judged: number }> {
    let judged = 0;
    while (!stop.is_set()) {
      let r: JudgeLoopReport | null = null;
      try {
        r = await this.run_once();
      } catch (e) {
        this.logger.error("judge.loop_error", { extra: { name: e instanceof Error ? e.name : "unknown" } });
      }
      if (r === null) await this.clock.sleep(this.opts.poll_ms);
      else judged += 1;
    }
    return { judged };
  }

  #fail(key: string): void {
    const fails = (this.#backoff.get(key)?.fails ?? 0) + 1;
    const wait = Math.min(this.opts.backoff_max_ms, this.opts.backoff_ms * 2 ** (fails - 1));
    this.#backoff.set(key, { next_at: this.clock.now().getTime() + wait, fails });
  }
}
