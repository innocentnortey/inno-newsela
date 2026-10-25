// NL-50 frozen test fixtures (synthetic only). Do not edit: hashed in docs/plans/frozen-tests/NL-50.manifest.json.
// WP-1 L4 per docs/data/worked-pairs.md (row 8, G6.U4.L4, "Learning in Action Part A"). No network, no keys, no DB.
import { InvariantViolation } from "@ls/core/errors";
import type {
  Actor,
  LessonId,
  ModelCallId,
  RequestUser,
  SuggestionId,
  UserId,
} from "@ls/core/ports/common";
import type { EditCommand, StoreAck } from "@ls/core/ports/collab-commands";
import type { AuditLog, NewAuditEvent } from "@ls/core/ports/audit";
import type { DerivedRow, LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { LessonRow, LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { RecordedCall } from "@ls/core/ports/model-call-log";
import type { PromptRepo, PromptVersionRow } from "@ls/core/ports/prompts";
import { FakeClock } from "@ls/core/ports/clock";
import type {
  NewSuggestion,
  SuggestionRepo,
  SuggestionRow,
} from "@ls/core/ports/suggestions";
import type { Tx, TxRunner } from "@ls/core/ports/tx";
import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked";
import { PromptRenderer } from "@ls/prompts/render";
import { SchemaRegistry } from "@ls/prompts/schemas";
import type { StoredLesson } from "@ls/schema/lesson";
import { SuggestionService } from "./suggestion-service.ts";

export const LID = "G6.U4.L4" as LessonId;
export const OTHER_LID = "G6.U4.L5" as LessonId;
export const SECTION = "Learning in Action Part A";
// 12 words from the WP-1 L4 Part A row text.
export const SELECTION =
  "Read the excerpt; a two-text evidence chart (Percy Soongoora what each does)";
export const NOTE = "Make this clearer for a sixth grader.";
export const T0 = new Date("2026-10-25T12:00:00.000Z");
export const MIN = 60_000;

const id = (p: string, c: string) => `${p}_${c.repeat(26)}`;
export const REVIEWER_USER = {
  user_id: id("usr", "4") as UserId,
  name: "Test reviewer",
  email: "reviewer@example.test",
  role: "reviewer",
  synthetic: true,
  request_id: "req_synthetic_1",
} as unknown as RequestUser;
export const AUTHOR_USER = {
  ...REVIEWER_USER,
  user_id: id("usr", "5") as UserId,
  name: "Test author",
  role: "author",
} as RequestUser;
export const APPROVER_USER = {
  ...REVIEWER_USER,
  user_id: id("usr", "6") as UserId,
  name: "Test approver",
  role: "approver",
} as RequestUser;
export const SUG_A = id("sug", "7") as SuggestionId;
export const SUG_MISSING = id("sug", "8") as SuggestionId;
export const HASH = "ab".repeat(32);
export const ANCHOR = {
  start: "anchor-start-opaque-1",
  end: "anchor-end-opaque-1",
};

export const req_body = (
  over: Partial<{
    anchor: { start: string; end: string };
    selected_text: string;
    note: string;
  }> = {},
) => ({
  anchor: ANCHOR,
  selected_text: SELECTION,
  note: NOTE,
  ...over,
});

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
export function make_lesson(): StoredLesson {
  return {
    lesson_id: LID,
    schema_version: 1,
    title: "Reading closely",
    type: "Reading",
    front_matter: { standards: [], minutes_total: 50, vocabulary: [] },
    sections: [
      {
        address: "G6.U4.L4.Launch",
        name: "Launch",
        minutes: 10,
        content: doc("Launch body"),
      },
      {
        address: "G6.U4.L4.LearningInAction.PartA",
        name: SECTION,
        minutes: 12,
        content: doc(`${SELECTION} and more.`),
      },
    ],
    text_cards: [],
  } as StoredLesson;
}

export class FakePaidCaller {
  calls: Array<{
    ctx: unknown;
    req: unknown;
    rendered: unknown;
    run_id: unknown;
    job_id: unknown;
    user_id: UserId;
  }> = [];
  private n = 0;
  next: (() => Promise<RecordedCall>) | null = null;
  output = JSON.stringify({
    suggested_text: "Read the excerpt and fill in the two-text evidence chart.",
  });
  async call(p: FakePaidCaller["calls"][number]): Promise<RecordedCall> {
    this.calls.push(p);
    if (this.next !== null) return this.next();
    this.n += 1;
    return {
      model_call_id: id("mc", String(this.n)) as ModelCallId,
      purpose: "assist",
      attempt: 1,
      raw_output: this.output,
      stop_reason: "end_turn",
    } as unknown as RecordedCall;
  }
}

export class MemorySuggestionRepo implements SuggestionRepo {
  rows: SuggestionRow[] = [];
  insert_calls = 0;
  constructor(private readonly clock: FakeClock) {}
  private view(r: SuggestionRow): SuggestionRow {
    return r.status === "pending" &&
      r.expires_at.getTime() <= this.clock.now().getTime()
      ? { ...r, status: "closed" }
      : { ...r };
  }
  async insert(s: NewSuggestion): Promise<SuggestionRow> {
    this.insert_calls += 1;
    const row: SuggestionRow = {
      suggestion_id: id("sug", String(this.rows.length + 1)) as SuggestionId,
      lesson_id: s.lesson_id,
      anchor_start: s.anchor_start,
      anchor_end: s.anchor_end,
      selected_text: s.selected_text,
      suggested_text: s.suggested_text,
      status: "pending",
      requested_by: s.requested_by,
      decided_by: null,
      decided_at: null,
      expires_at: s.expires_at,
      model_call_id: s.model_call_id,
    };
    this.rows.push(row);
    return { ...row };
  }
  seed(over: Partial<SuggestionRow> = {}): SuggestionRow {
    const row: SuggestionRow = {
      suggestion_id: SUG_A,
      lesson_id: LID,
      anchor_start: ANCHOR.start,
      anchor_end: ANCHOR.end,
      selected_text: SELECTION,
      suggested_text: "A stored rewrite.",
      status: "pending",
      requested_by: REVIEWER_USER.user_id,
      decided_by: null,
      decided_at: null,
      expires_at: new Date(this.clock.now().getTime() + 30 * MIN),
      model_call_id: id("mc", "9") as ModelCallId,
      ...over,
    };
    this.rows.push(row);
    return row;
  }
  async get(sid: SuggestionId) {
    const r = this.rows.find((x) => x.suggestion_id === sid);
    return r === undefined ? null : this.view(r);
  }
  async decide(
    sid: SuggestionId,
    status: "accepted" | "rejected" | "closed",
    by: UserId,
    _tx: Tx,
  ): Promise<SuggestionRow> {
    const r = this.rows.find((x) => x.suggestion_id === sid);
    if (r === undefined || this.view(r).status !== "pending")
      throw new InvariantViolation("suggestion_not_pending", {
        suggestion_id: sid,
      });
    r.status = status;
    r.decided_by = by;
    r.decided_at = this.clock.now();
    return { ...r };
  }
  async pending_for(lesson_id: LessonId, now: Date) {
    return this.rows
      .filter(
        (r) =>
          r.lesson_id === lesson_id &&
          r.status === "pending" &&
          r.expires_at.getTime() > now.getTime(),
      )
      .map((r) => ({ ...r }));
  }
  status_of(sid: SuggestionId): SuggestionRow["status"] | undefined {
    return this.rows.find((x) => x.suggestion_id === sid)?.status;
  }
}

export class MemoryAudit implements AuditLog {
  events: NewAuditEvent[] = [];
  async append(e: NewAuditEvent, _tx: Tx) {
    this.events.push(e);
    return id("ae", "1") as never;
  }
  async history() {
    return [];
  }
  async standard_decisions() {
    return [];
  }
}

export class RecordingCollab {
  calls: EditCommand[] = [];
  behave: (cmd: EditCommand) => Promise<StoreAck> = async () => ack();
  async apply_edit(cmd: EditCommand): Promise<StoreAck> {
    this.calls.push(cmd);
    return this.behave(cmd);
  }
}
export const ack = (): StoreAck =>
  ({
    lesson_id: LID,
    store_id: id("st", "1"),
    seq: 2,
    content_hash: HASH,
    state_vector: "c".repeat(64),
    stored_at: T0,
    stored_by: null,
    check_job_enqueued: true,
  }) as unknown as StoreAck;

export class FakeStates {
  gets: LessonId[] = [];
  constructor(public state: LessonRow["state"] | null = "in_review") {}
  async get(lesson_id: LessonId): Promise<LessonRow | null> {
    this.gets.push(lesson_id);
    if (this.state === null) return null;
    return {
      lesson_id,
      unit_id: "G6.U4",
      number: 4,
      type: "Reading",
      title: "Reading closely",
      state: this.state,
      current_version_id: null,
      reviewer_id: null,
      last_editor_id: null,
      schema_version: 1,
    } as unknown as LessonRow;
  }
}

export class FakeReader {
  async latest() {
    return null;
  }
  async latest_derived(lesson_id: LessonId): Promise<DerivedRow> {
    return {
      lesson_id,
      seq: 1,
      store_id: id("st", "1"),
      lesson: make_lesson(),
      content_hash: HASH,
      state_vector: "c".repeat(64),
      schema_version: 1,
      stored_at: T0,
      stored_by: null,
    } as unknown as DerivedRow;
  }
}

export const PassThroughTx: TxRunner = { with_tx: async (fn) => fn({}) };

export class FakePrompts {
  async current(): Promise<PromptVersionRow> {
    return {
      prompt_version_id: "pv_synthetic",
      number: 1,
      locked_hash: locked_hash(LOCKED_DIR),
      guidance_text: "",
      author_id: null,
      reason: null,
      diff: null,
      created_at: T0,
    } as unknown as PromptVersionRow;
  }
}

export function build_service() {
  const clock = new FakeClock(T0);
  const paid = new FakePaidCaller();
  const repo = new MemorySuggestionRepo(clock);
  const audit = new MemoryAudit();
  const collab = new RecordingCollab();
  const states = new FakeStates("in_review");
  const renderer = new PromptRenderer(LOCKED_DIR, new SchemaRegistry());
  const service = new SuggestionService(
    paid as never,
    renderer,
    new FakePrompts() as unknown as PromptRepo,
    repo,
    states as unknown as LessonStateRepo,
    collab as never,
    audit,
    PassThroughTx,
    clock,
    { assist_call_timeout_ms: 20000, suggestion_ttl_min: 30 },
    new FakeReader() as unknown as LessonDocReader,
  );
  return { service, paid, repo, audit, collab, clock, states };
}

export const actor_of = (u: RequestUser): Actor => ({
  user_id: u.user_id,
  name: u.name,
  role: u.role,
  synthetic: u.synthetic,
});
