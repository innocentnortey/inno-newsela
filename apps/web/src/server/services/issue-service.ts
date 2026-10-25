// IssueService (NL-45, DO-4 section 5): issue list, recorded resolutions, safety-flag clearing and standard decisions.
// Never writes lesson content except through CollabCommands.apply_edit. Refusals come before any write.
import { DomainRefusal, CollabUnavailable } from "@ls/core/errors";
import { NON_RESOLVABLE } from "@ls/core/checks/gates";
import { is_editable } from "@ls/core/lifecycle/lesson-machine";
import type { AlignmentRepo, AlignmentLinkRow } from "@ls/core/ports/alignment";
import type { AuditLog } from "@ls/core/ports/audit";
import type { CheckQueue } from "@ls/core/ports/check-queue";
import type { Clock } from "@ls/core/ports/clock";
import type { CollabCommands } from "@ls/core/ports/collab-commands";
import type { Actor, CheckKind, IssueId, JsonValue, LessonId, LessonStateName, RequestUser } from "@ls/core/ports/common";
import type { IssueRepo, IssueRow } from "@ls/core/ports/issues";
import type { LessonGraphRepo, DependencyState } from "@ls/core/ports/lesson-graph";
import type { LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { LessonRow, LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { SafetyFlagRepo } from "@ls/core/ports/safety-flags";
import type { TxRunner } from "@ls/core/ports/tx";
import type { WebSettings } from "@ls/config/settings";
import type {
  Issue,
  IssueCounts,
  IssueList,
  ResolutionRequest,
  ResolveResult,
  SafetyFlagClearRequest,
  StandardDecisionRequest,
} from "@ls/schema/api/lessons";
import type { ErrorCode } from "@ls/schema/api/common";

export interface IssueApi {
  get_issues(user: RequestUser, lesson_id: LessonId): Promise<IssueList>;
  record_resolution(user: RequestUser, lesson_id: LessonId, issue_id: IssueId, req: ResolutionRequest): Promise<ResolveResult>;
  clear_safety_flag(user: RequestUser, lesson_id: LessonId, flag_id: string, req: SafetyFlagClearRequest): Promise<ResolveResult>;
  decide_standard(user: RequestUser, lesson_id: LessonId, req: StandardDecisionRequest): Promise<ResolveResult>;
}

const FLAG_CLEAR_STATES: ReadonlySet<LessonStateName> = new Set<LessonStateName>([
  "in_review",
  "submitted",
  "changes_requested",
  "reopened",
]);

const USE_FOR: Partial<Record<CheckKind, string>> = {
  standard_confirmation: "decideStandard",
  safety_flag_open: "clearSafetyFlag",
  suggestion_pending: "decideSuggestion",
  rights_to_clear: "fillSlot",
  safety_note_without_tip: "editContent",
  safety_text_in_student_block: "editContent",
  cross_lesson_link: "approveSourceLesson",
};

const DECISION_STATUS = { confirm: "confirmed", remove: "removed", add: "added" } as const;

function refuse(code: ErrorCode, message: string, details: JsonValue = {}): never {
  throw new DomainRefusal(code, message, details);
}

const is_open = (r: IssueRow): boolean => r.resolved_at === null && r.cleared_by === null;

function counts_of(rows: readonly IssueRow[]): IssueCounts {
  const counts: IssueCounts = { blocking: 0, confirmation: 0, advisory: 0 };
  for (const r of rows) if (is_open(r)) counts[r.level] += 1;
  return counts;
}

const visible = (rows: readonly IssueRow[]): IssueRow[] => rows.filter((r) => r.cleared_by !== "fix");

function actor_of(user: RequestUser): Actor {
  return { user_id: user.user_id, name: user.name, role: user.role, synthetic: user.synthetic };
}

export function blocks_for(row: IssueRow, deps: readonly DependencyState[]): ("submit" | "approve")[] {
  if (row.level === "advisory") return [];
  if (row.kind === "cross_lesson_link") {
    const d = deps.find((x) => x.direction === "waits_on" && x.lesson_id === row.related_lesson_id);
    if (d !== undefined && d.slot_filled && d.source_state !== "approved" && d.source_state !== "exported") return ["approve"];
  }
  return ["submit", "approve"];
}

export const resolvable_for = (row: IssueRow): boolean => !NON_RESOLVABLE.has(row.kind);

export class IssueService implements IssueApi {
  constructor(
    private readonly issues: IssueRepo,
    private readonly checks: CheckQueue,
    private readonly flags: SafetyFlagRepo,
    private readonly alignment: AlignmentRepo,
    private readonly states: LessonStateRepo,
    private readonly collab: CollabCommands,
    private readonly audit: AuditLog,
    private readonly tx: TxRunner,
    private readonly clock: Clock,
    private readonly settings: Pick<WebSettings, "undo_window_s">,
    private readonly graph: LessonGraphRepo,
    private readonly reader: LessonDocReader,
  ) {}

  private async load_lesson(lesson_id: LessonId): Promise<LessonRow> {
    const row = await this.states.get(lesson_id);
    if (row === null) return refuse("NOT_FOUND", "Lesson not found.", { lesson_id });
    return row;
  }

  private require_editable(row: LessonRow): void {
    if (!is_editable(row.state, "reviewer")) refuse("LESSON_LOCKED", "The lesson is not editable.", { state: row.state });
  }

  private async current_counts(lesson_id: LessonId): Promise<IssueCounts> {
    return counts_of(visible((await this.issues.current(lesson_id)).issues));
  }

  async get_issues(_user: RequestUser, lesson_id: LessonId): Promise<IssueList> {
    await this.load_lesson(lesson_id);
    const [set, pending, deps] = await Promise.all([
      this.issues.current(lesson_id),
      this.checks.pending_for(lesson_id),
      this.graph.dependencies(lesson_id),
    ]);
    const stored = pending.latest_stored_hash;
    if (stored === null) return refuse("NOT_FOUND", "Lesson has no stored content.", { lesson_id });
    const rows = visible(set.issues);
    const checked_at = set.checked_at ?? pending.latest_stored_at ?? this.clock.now();
    const issues: Issue[] = rows.map((r) => ({
      issue_id: r.issue_id,
      level: r.level,
      blocks: blocks_for(r, deps),
      resolvable: resolvable_for(r),
      kind: r.kind,
      message: r.message,
      address: r.address,
      span_anchor: r.span_anchor,
      related_lesson_id: r.related_lesson_id,
      resolution:
        r.resolved_at === null
          ? null
          : { by: r.resolved_by ?? "", reason: r.resolution_reason ?? "", at: r.resolved_at.toISOString() },
    }));
    return {
      lesson_id,
      stored_hash: stored,
      checked_hash: set.checked_hash ?? stored,
      checked_at: checked_at.toISOString(),
      pending: pending.pending || set.checked_hash === null,
      counts: counts_of(rows),
      issues,
    };
  }

  async record_resolution(user: RequestUser, lesson_id: LessonId, issue_id: IssueId, req: ResolutionRequest): Promise<ResolveResult> {
    if (user.role !== "reviewer") refuse("ROLE_FORBIDDEN", "Your role cannot do this.");
    const row = await this.load_lesson(lesson_id);
    const cur = await this.issues.current(lesson_id);
    const issue = cur.issues.find((r) => r.issue_id === issue_id);
    if (issue === undefined) return refuse("NOT_FOUND", "Issue not found.", { lesson_id, issue_id });
    this.require_editable(row);
    if (req.reason.trim() === "") refuse("REASON_REQUIRED", "A reason is required.");
    if (NON_RESOLVABLE.has(issue.kind)) {
      refuse("NOT_RESOLVABLE", "This kind of issue cannot be resolved with a reason.", {
        kind: issue.kind,
        use: USE_FOR[issue.kind] ?? "editContent",
      });
    }
    const done = await this.tx.with_tx(async (tx) => {
      const r = await this.issues.resolve({ issue_id, by: user.user_id, reason: req.reason, request_id: user.request_id }, tx);
      const audit_id = await this.audit.append(
        {
          actor_id: user.user_id,
          action: "issue.resolve",
          target_kind: "issue",
          target_id: issue_id,
          version_hash: issue.content_hash,
          reason: req.reason,
          details: { lesson_id, kind: issue.kind, code: issue.code, address: issue.address },
          request_id: user.request_id,
          store_id: null,
        },
        tx,
      );
      return { r, audit_id };
    });
    return {
      item_id: issue_id,
      status: "resolved",
      by: user.name,
      at: (done.r.resolved_at ?? this.clock.now()).toISOString(),
      audit_id: done.audit_id,
      counts: await this.current_counts(lesson_id),
    };
  }

  async clear_safety_flag(user: RequestUser, lesson_id: LessonId, flag_id: string, req: SafetyFlagClearRequest): Promise<ResolveResult> {
    if (user.role !== "reviewer" && user.role !== "approver") refuse("ROLE_FORBIDDEN", "Your role cannot do this.");
    const row = await this.load_lesson(lesson_id);
    const flag = (await this.flags.open_for(lesson_id)).find((f) => f.flag_id === flag_id);
    if (flag === undefined) return refuse("NOT_FOUND", "Safety flag not found.", { lesson_id, flag_id });
    if (!FLAG_CLEAR_STATES.has(row.state)) refuse("LESSON_LOCKED", "The lesson is not editable.", { state: row.state });
    if (req.note.trim() === "") refuse("NOTE_REQUIRED", "A note is required to clear a safety flag.");
    const done = await this.tx.with_tx(async (tx) => {
      const cleared = await this.flags.clear(flag_id, user.user_id, req.note, tx);
      const doc = await this.reader.latest(lesson_id);
      const audit_id = await this.audit.append(
        {
          actor_id: user.user_id,
          action: "safety_flag.clear",
          target_kind: "safety_flag",
          target_id: flag_id,
          version_hash: doc?.content_hash ?? null,
          reason: req.note,
          details: { lesson_id, source_row: flag.source_row },
          request_id: user.request_id,
          store_id: null,
        },
        tx,
      );
      // Re-check the already-checked hash so the stale safety_flag_open issue is dropped; the document is untouched.
      if (doc !== null) await this.checks.enqueue(lesson_id, doc.content_hash, doc.store_id, tx);
      return { cleared, audit_id };
    });
    return {
      item_id: flag_id,
      status: "cleared",
      by: user.name,
      at: (done.cleared.cleared_at ?? this.clock.now()).toISOString(),
      audit_id: done.audit_id,
      counts: await this.current_counts(lesson_id),
    };
  }

  async decide_standard(user: RequestUser, lesson_id: LessonId, req: StandardDecisionRequest): Promise<ResolveResult> {
    if (user.role !== "reviewer") refuse("ROLE_FORBIDDEN", "Your role cannot do this.");
    const row = await this.load_lesson(lesson_id);
    if (req.decision === "undo") return this.undo(user, lesson_id, row, req);
    const decision = req.decision;
    this.require_editable(row);
    const derived = await this.reader.latest_derived(lesson_id);
    if (derived === null) return refuse("NOT_FOUND", "Lesson has no stored content.", { lesson_id });
    const entry = derived.lesson.front_matter.standards.find((s) => s.code === req.code) ?? null;
    const before_links = (await this.alignment.for_lesson(lesson_id)).filter((l) => l.code === req.code);
    if (decision === "add") {
      if (entry !== null && entry.confirmation !== "removed") refuse("INVALID_REQUEST", "The request is not valid.", { fields: ["code"] });
    } else {
      if (entry === null || (entry.origin !== "narrowed" && entry.origin !== "added")) {
        refuse("INVALID_REQUEST", "The request is not valid.", { fields: ["code"] });
      }
      if (before_links.length === 0) refuse("NOT_FOUND", "No alignment rows for this code yet.", { lesson_id, code: req.code });
    }
    // Order is deliberate (plan R2): alignment first (it needs the current hash's rows), then the store, then audit.
    const audit_id = await this.guard_collab(lesson_id, () =>
      this.tx.with_tx(async (tx) => {
        await this.alignment.confirm(lesson_id, req.code, user.user_id, decision, tx);
        const ack = await this.collab.apply_edit({
          lesson_id,
          actor: actor_of(user),
          edit: { kind: "standard", code: req.code, decision, restore: null },
          tag: "standard-decision",
          request_id: user.request_id,
        });
        return this.audit.append(
          {
            actor_id: user.user_id,
            action: `standard.${decision}`,
            target_kind: "lesson",
            target_id: lesson_id,
            version_hash: ack.content_hash,
            reason: null,
            details: { code: req.code, decision, undo_of: null, before_entry: entry, before_links: links_json(before_links) },
            request_id: user.request_id,
            store_id: ack.store_id,
          },
          tx,
        );
      }),
    );
    return {
      item_id: req.code,
      status: DECISION_STATUS[decision],
      by: user.name,
      at: this.clock.now().toISOString(),
      audit_id,
      counts: await this.current_counts(lesson_id),
    };
  }

  private async undo(user: RequestUser, lesson_id: LessonId, row: LessonRow, req: StandardDecisionRequest): Promise<ResolveResult> {
    const undo_of = req.undo_of;
    if (undo_of === null || undo_of === undefined || undo_of.trim() === "") {
      return refuse("INVALID_REQUEST", "The request is not valid.", { fields: ["undo_of"] });
    }
    const history = await this.audit.standard_decisions(lesson_id, req.code);
    const target = history.find((h) => h.audit_id === undo_of);
    if (target === undefined || target.by !== user.user_id) {
      return refuse("NOT_FOUND", "Decision not found.", { lesson_id, code: req.code });
    }
    if (target.decision === "undo") return refuse("INVALID_REQUEST", "The request is not valid.", { fields: ["undo_of"] });
    this.require_editable(row);
    const age_ms = this.clock.now().getTime() - target.at.getTime();
    if (age_ms > this.settings.undo_window_s * 1000 || history[0]?.audit_id !== target.audit_id) {
      refuse("UNDO_EXPIRED", "The undo window has passed.", { code: req.code });
    }
    const derived = await this.reader.latest_derived(lesson_id);
    if (derived === null) return refuse("NOT_FOUND", "Lesson has no stored content.", { lesson_id });
    const entry_now = derived.lesson.front_matter.standards.find((s) => s.code === req.code) ?? null;
    const links_now = (await this.alignment.for_lesson(lesson_id)).filter((l) => l.code === req.code);
    const audit_id = await this.guard_collab(lesson_id, () =>
      this.tx.with_tx(async (tx) => {
        await this.alignment.restore(lesson_id, req.code, target.before_links, tx);
        const ack = await this.collab.apply_edit({
          lesson_id,
          actor: actor_of(user),
          edit: { kind: "standard", code: req.code, decision: "undo", restore: target.before_entry },
          tag: "standard-decision",
          request_id: user.request_id,
        });
        return this.audit.append(
          {
            actor_id: user.user_id,
            action: "standard.undo",
            target_kind: "lesson",
            target_id: lesson_id,
            version_hash: ack.content_hash,
            reason: null,
            details: { code: req.code, decision: "undo", undo_of: target.audit_id, before_entry: entry_now, before_links: links_json(links_now) },
            request_id: user.request_id,
            store_id: ack.store_id,
          },
          tx,
        );
      }),
    );
    return {
      item_id: req.code,
      status: "undone",
      by: user.name,
      at: this.clock.now().toISOString(),
      audit_id,
      counts: await this.current_counts(lesson_id),
    };
  }

  private async guard_collab<T>(lesson_id: LessonId, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (e) {
      if (e instanceof CollabUnavailable) {
        return refuse("COLLAB_UNAVAILABLE", "The collaboration server is unavailable. Try again.", { lesson_id });
      }
      throw e;
    }
  }
}

// AlignmentLinkRow holds only strings and nulls, so it is already plain JSON.
const links_json = (rows: readonly AlignmentLinkRow[]): JsonValue => rows.map((r) => ({ ...r }));
