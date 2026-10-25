// NL-53: ApproveService.approve, the approval-integrity code (CON-18, DO-4 §5).
// One transaction with the lesson row locked. Everything is decided from the stored SUBMIT SNAPSHOT: the live
// row, the live document and the client's view of blocking issues are never read. A refused call writes nothing.
import type { WebSettings } from "@ls/config/settings";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CHECK_RULES } from "@ls/core/checks/registry";
import { approve_gate, merge_resolutions } from "@ls/core/checks/gates";
import type { CheckContextLoader } from "@ls/core/checks/context-loader";
import type { CheckPolicy, CheckRuleList, GateState } from "@ls/core/checks/types";
import { DomainRefusal } from "@ls/core/errors";
import { decide_transition } from "@ls/core/lifecycle/lesson-machine";
import type { Clock } from "@ls/core/ports/clock";
import type { LessonId, RequestUser } from "@ls/core/ports/common";
import type { IssueRepo } from "@ls/core/ports/issues";
import type { LessonGraphRepo } from "@ls/core/ports/lesson-graph";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { DependencyRecordEntry, LessonVersionRepo } from "@ls/core/ports/lesson-versions";
import type { SuggestionRepo } from "@ls/core/ports/suggestions";
import type { TxRunner } from "@ls/core/ports/tx";
import type { Approve, TransitionResult } from "@ls/schema/api/transition";
import type { MetricsWriter } from "./metrics-writer.ts";

export type ApproveRequest = Omit<Approve, "rating"> & { rating?: Approve["rating"] | null };

export interface ApproveApi {
  approve(user: RequestUser, lesson_id: LessonId, req: ApproveRequest): Promise<TransitionResult>;
}

export class ApproveService implements ApproveApi {
  constructor(
    private readonly states: LessonStateRepo,
    private readonly versions: LessonVersionRepo,
    private readonly graph: LessonGraphRepo,
    private readonly issues: IssueRepo,
    private readonly suggestions: SuggestionRepo,
    private readonly loader: CheckContextLoader,
    private readonly metrics: MetricsWriter,
    private readonly tx: TxRunner,
    private readonly clock: Clock,
    private readonly settings: Pick<WebSettings, "four_eyes_enabled">,
    private readonly rules: CheckRuleList = CHECK_RULES,
    private readonly policy: CheckPolicy = CHECK_POLICY,
  ) {}

  async approve(user: RequestUser, lesson_id: LessonId, req: ApproveRequest): Promise<TransitionResult> {
    return this.tx.with_tx(async (tx) => {
      // 1. Serialise concurrent approvals on the lesson row; re-decide on the locked row (second approver sees approved).
      const row = await this.states.lock_for_update(lesson_id, tx);
      const d = decide_transition({ action: "approve", role: user.role, from_state: row.state, rating: req.rating });
      if (!d.allowed) {
        throw new DomainRefusal(d.refusal ?? "INVALID_TRANSITION", "This lesson cannot be approved now.", { lesson_id });
      }

      // 2. The pin: hash AND state vector of the latest snapshot, which must be a submit.
      const snap = await this.versions.latest_snapshot(lesson_id);
      if (
        snap === null ||
        snap.kind !== "submit" ||
        snap.content_hash !== req.snapshot_hash ||
        snap.state_vector !== req.snapshot_state_vector
      ) {
        throw new DomainRefusal("STALE_PIN", "The lesson changed since you opened it. Reload and read it again.", {
          request_id: user.request_id,
        });
      }

      // 3. Re-run the checks on the snapshot and carry recorded resolutions.
      const ctx = await this.loader.load(lesson_id, snap.lesson, snap.content_hash);
      // The registry's rules are applied directly: run_checks would also derive the alignment view, which the gate
      // does not use (see Deviations in the NL-53 plan).
      const findings = this.rules.flatMap((rule) => rule.run(ctx, this.policy));
      const issues = merge_resolutions(findings, await this.issues.resolutions_for(lesson_id));

      // 4. Gates, in the order approve_gate ranks them.
      const dependencies = await this.graph.dependencies(lesson_id);
      const state: GateState = {
        action: "approve",
        issues,
        pending_check: false,
        pending_suggestions: (await this.suggestions.pending_for(lesson_id, this.clock.now())).length,
        open_confirmations: issues.filter((i) => i.level === "confirmation" && !i.resolved).length,
        last_editor_id: row.last_editor_id,
        approver_id: user.user_id,
        four_eyes_enabled: this.settings.four_eyes_enabled,
        dependencies,
      };
      const g = approve_gate(state);
      if (!g.allowed) {
        throw new DomainRefusal(g.refusals[0] ?? "BLOCKED", "This lesson cannot be approved yet.", g.details);
      }

      // 5. Writes: nothing is written before this point.
      const dependency_record: DependencyRecordEntry[] = dependencies
        .filter((x) => x.direction === "waits_on" && x.source_approved_hash !== null)
        .map((x) => ({ lesson_id: x.lesson_id, approved_hash: x.source_approved_hash! }));
      const v = await this.versions.write_snapshot(
        {
          lesson_id,
          kind: "approve",
          lesson: snap.lesson,
          content_hash: snap.content_hash,
          state_vector: snap.state_vector!,
          dependency_record,
          created_by: user.user_id,
        },
        tx,
      );
      await this.states.set_state(lesson_id, "approved", row.reviewer_id, tx);
      const ev = await this.states.append_review_event(
        {
          lesson_id,
          version_id: v.version_id,
          from_state: "submitted",
          to_state: "approved",
          actor_id: user.user_id,
          reason: null,
          reason_tag: null,
          note: null,
          content_hash: v.content_hash,
          request_id: user.request_id,
        },
        tx,
      );
      const m = await this.metrics.write_first_approval(lesson_id, v, req.rating!, tx);
      return {
        lesson_id,
        from_state: "submitted",
        to_state: "approved",
        version: {
          version_id: v.version_id,
          version_number: v.number,
          content_hash: v.content_hash,
          state_vector: v.state_vector ?? "",
        },
        audit_id: ev.review_event_id,
        dependency_record,
        metrics_row_written: m.written,
      } as TransitionResult;
    });
  }
}
