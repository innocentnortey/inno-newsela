// NL-53 frozen test fixtures (synthetic only). Do not edit: hashed in docs/plans/frozen-tests/NL-53.manifest.json.
// An in-memory "world" (lesson row, versions, review events, metrics) behind the real ports, with a lock that
// behaves like SELECT ... FOR UPDATE (held to the end of the transaction) and rollback on throw.
// Lesson ids follow WP-1 (G6.U4.L4 -> G6.U4.L5). No network, no keys, no DB.
import type { CheckRuleList, CheckFinding, CheckKind } from "@ls/core/checks/types";
import { CollabUnavailable } from "@ls/core/errors";
import type {
  CollabCommands,
  ModeCommand,
  SnapshotResult,
  SubmitCommand,
} from "@ls/core/ports/collab-commands";
import type { LessonId, RequestUser, UserId, VersionId } from "@ls/core/ports/common";
import { FakeClock } from "@ls/core/ports/clock";
import type { DependencyState } from "@ls/core/ports/lesson-graph";
import type { LessonStateRepo, LessonRow, NewReviewEvent, ReviewEventRow } from "@ls/core/ports/lesson-state";
import type { LessonVersionRepo, LessonVersionRow, NewSnapshot } from "@ls/core/ports/lesson-versions";
import type { Tx, TxRunner } from "@ls/core/ports/tx";
import type { StoredLesson } from "@ls/schema/lesson";
import { make_with_route, type HttpRequest, type HttpResponse, type SessionResolver } from "../http/with-route.ts";
import { APP_ORIGIN, DomainRefusal as FixtureRefusal, make_log } from "../http/testing/route-fixtures.ts";
import { make_transition_handlers } from "../routes/transition-routes.ts";
import { ApproveService } from "./approve-service.ts";
import { TransitionService } from "./transition-service.ts";

export const LID = "G6.U4.L5" as LessonId;
export const SRC_LID = "G6.U4.L4" as LessonId;
export const UNKNOWN_LID = "G6.U4.L9" as LessonId;
export const HASH = "ab".repeat(32);
export const HASH2 = "cd".repeat(32);
export const SRC_HASH = "ef".repeat(32);
export const VEC = "AAAA";
export const VEC2 = "BBBB";
export const NOTE_MARK = "NOTE-QZ-53";
export const KEY_MARK = "sk-ant-synthetic-KEY-QZ53";
export const T0 = new Date("2026-10-25T12:00:00.000Z");

const id = (p: string, c: string) => `${p}_${c.repeat(26)}`;
const mk = (role: RequestUser["role"], c: string, name: string): Omit<RequestUser, "request_id"> =>
  ({ user_id: id("usr", c) as UserId, name, email: `${name}@example.test`, role, synthetic: true }) as never;
export const PEOPLE = {
  "reviewer-token": mk("reviewer", "4", "reviewer"),
  "approver-token": mk("approver", "6", "approver"),
  "approver2-token": mk("approver", "7", "approver2"),
  "author-token": mk("author", "5", "author"),
} as const;
export type Token = keyof typeof PEOPLE;
export const REVIEWER_ID = PEOPLE["reviewer-token"].user_id as UserId;
export const APPROVER_ID = PEOPLE["approver-token"].user_id as UserId;
export const user_for = (t: Token, request_id = "req_synthetic_direct"): RequestUser =>
  ({ ...PEOPLE[t], request_id }) as RequestUser;

export const make_lesson = (title: string): StoredLesson =>
  ({
    lesson_id: LID,
    schema_version: 1,
    title,
    type: "Reading",
    front_matter: { standards: [], minutes_total: 50, vocabulary: [] },
    sections: [],
    text_cards: [],
  }) as unknown as StoredLesson;

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

interface TxHandle { release?: () => void; snap?: Snap }
interface Snap { lesson: LessonRow | null; versions: LessonVersionRow[]; events: ReviewEventRow[]; metrics: MetricsRow[] }
export interface MetricsRow { lesson_id: LessonId; version_id: VersionId; rating: string }

export class World {
  log: string[] = [];
  lesson: LessonRow | null;
  versions: LessonVersionRow[] = [];
  events: Array<ReviewEventRow & { note: string | null; reason: string | null; reason_tag: string | null; version_id: VersionId | null }> = [];
  metrics: MetricsRow[] = [];
  audit_events: unknown[] = [];
  deps: DependencyState[] = [];
  recorded: Array<{ kind: CheckKind; address: string | null; code: string | null }> = [];
  pending_suggestions = 0;
  live = { title: "live clean", hash: HASH, vector: VEC };
  fail_commit_once = false;
  private tail: Promise<void> = Promise.resolve();
  private n = 0;
  constructor(state: LessonRow["state"] | null = "submitted") {
    this.lesson =
      state === null
        ? null
        : {
            lesson_id: LID, unit_id: "G6.U4" as never, number: 5, type: "Reading", title: "Lesson 5",
            state, current_version_id: null, reviewer_id: REVIEWER_ID, last_editor_id: REVIEWER_ID, reviewer_name: null, last_editor_name: null, schema_version: 1,
          };
  }
  next(p: string): string { this.n += 1; return `${p}_${String(this.n).padStart(26, "0")}`; }
  add_version(kind: LessonVersionRow["kind"], title: string, hash = HASH, vec: string | null = VEC, extra: Partial<LessonVersionRow> = {}): LessonVersionRow {
    const v = {
      version_id: this.next("lv") as VersionId, lesson_id: LID, number: this.versions.length + 1, kind, adopted: false,
      content_hash: hash, state_vector: vec, lesson: make_lesson(title), draft: null, teacher_word_count: 0,
      provenance: { derived_from_version_id: null }, dependency_record: [], created_by: null, stored_at: T0, ...extra,
    } as unknown as LessonVersionRow;
    this.versions.push(v);
    if (this.lesson) this.lesson.current_version_id = v.version_id;
    return v;
  }
  counts() {
    return { versions: this.versions.length, events: this.events.length, metrics: this.metrics.length, state: this.lesson?.state ?? null };
  }
  count_kind(k: string) { return this.versions.filter((v) => v.kind === k).length; }
  snapshot(): Snap {
    return {
      lesson: this.lesson ? { ...this.lesson } : null,
      versions: [...this.versions], events: [...this.events], metrics: [...this.metrics],
    };
  }
  restore(s: Snap) { this.lesson = s.lesson; this.versions = s.versions; this.events = s.events as never; this.metrics = s.metrics; }
  async lock(tx: TxHandle) {
    if (tx.release) return;
    const prev = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((r) => { release = r; });
    await prev;
    tx.release = release;
    tx.snap = this.snapshot();
    this.log.push("lock");
  }
  dump(): string {
    return JSON.stringify({ l: this.lesson, v: this.versions, e: this.events.map((e) => ({ ...e, note: undefined, reason: undefined })), m: this.metrics });
  }
}

export class RecordingTx implements TxRunner {
  constructor(private readonly w: World) {}
  async with_tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const tx: TxHandle = {};
    this.w.log.push("begin");
    try {
      const out = await fn(tx);
      if (this.w.fail_commit_once) {
        this.w.fail_commit_once = false;
        if (tx.snap) this.w.restore(tx.snap);
        this.w.log.push("commit_failed");
        throw new Error("commit failed");
      }
      this.w.log.push("commit");
      return out;
    } catch (e) {
      if (tx.snap) this.w.restore(tx.snap);
      if (!this.w.log.includes("commit_failed") || this.w.log[this.w.log.length - 1] !== "commit_failed") this.w.log.push("rollback");
      throw e;
    } finally {
      tx.release?.();
    }
  }
}

const nope = (m: string) => async (): Promise<never> => { throw new Error(`unexpected port call: ${m}`); };

export class MemStates implements LessonStateRepo {
  constructor(private readonly w: World) {}
  async get(id: LessonId) { await tick(); return this.w.lesson && this.w.lesson.lesson_id === id ? { ...this.w.lesson } : null; }
  async lock_for_update(id: LessonId, tx: Tx) {
    await this.w.lock(tx as TxHandle);
    if (!this.w.lesson || this.w.lesson.lesson_id !== id) throw new Error("lesson missing under lock");
    return { ...this.w.lesson };
  }
  async set_state(_id: LessonId, to: LessonRow["state"], reviewer: UserId | null, _tx: Tx) {
    await tick();
    this.w.lesson = { ...this.w.lesson!, state: to, reviewer_id: reviewer };
    this.w.log.push(`set_state:${to}`);
    return { ...this.w.lesson };
  }
  async append_review_event(e: NewReviewEvent, _tx: Tx) {
    await tick();
    const row = {
      review_event_id: this.w.next("re"), lesson_id: e.lesson_id, from_state: e.from_state, to_state: e.to_state,
      actor_id: e.actor_id, at: T0, note: e.note, reason: e.reason, reason_tag: e.reason_tag, version_id: e.version_id,
    };
    this.w.events.push(row);
    this.w.log.push("review_event");
    return row as unknown as ReviewEventRow;
  }
  state_of = nope("state_of") as never;
  ensure_lessons = nope("ensure_lessons") as never;
  record_last_editor = nope("record_last_editor") as never;
}

export class MemVersions implements LessonVersionRepo {
  constructor(private readonly w: World) {}
  async latest_snapshot(id: LessonId) {
    await tick();
    const s = this.w.versions.filter((v) => v.lesson_id === id && ["submit", "approve", "reopen"].includes(v.kind));
    return s.length ? s[s.length - 1]! : null;
  }
  async version(vid: VersionId) { return this.w.versions.find((v) => v.version_id === vid) ?? null; }
  async write_snapshot(s: NewSnapshot, _tx: Tx) {
    await tick();
    const prev_approve = [...this.w.versions].reverse().find((v) => v.kind === "approve");
    const v = this.w.add_version(s.kind, s.lesson.title, s.content_hash, s.state_vector, {
      dependency_record: s.dependency_record, created_by: s.created_by,
      provenance: { derived_from_version_id: s.kind === "reopen" ? (prev_approve?.version_id ?? null) : null } as never,
    });
    this.w.log.push(`write_snapshot:${s.kind}`);
    return v;
  }
  write_generated_version = nope("write_generated_version") as never;
  candidate = nope("candidate") as never;
  has_generated_version = nope("has_generated_version") as never;
  approved_snapshots = nope("approved_snapshots") as never;
  mark_adopted = nope("mark_adopted") as never;
}

export class RecordingCollab implements CollabCommands {
  submits: SubmitCommand[] = [];
  modes: ModeCommand[] = [];
  submit_behave: ((cmd: SubmitCommand) => Promise<SnapshotResult>) | null = null;
  mode_behave: ((cmd: ModeCommand) => Promise<void>) | null = null;
  constructor(private readonly w: World) {}
  // Default behaves like the collaboration server: it alone writes the submit snapshot and the move.
  async lock_and_snapshot(cmd: SubmitCommand): Promise<SnapshotResult> {
    this.submits.push(cmd);
    this.w.log.push("collab:lock_and_snapshot");
    if (this.submit_behave) return this.submit_behave(cmd);
    const w = this.w;
    const from = w.lesson!.state;
    const v = w.add_version("submit", w.live.title, w.live.hash, w.live.vector, { created_by: cmd.actor.user_id });
    w.lesson = { ...w.lesson!, state: "submitted" };
    const ev = await new MemStates(w).append_review_event(
      { lesson_id: cmd.lesson_id, version_id: v.version_id, from_state: from, to_state: "submitted", actor_id: cmd.actor.user_id as UserId,
        reason: null, reason_tag: null, note: null, content_hash: v.content_hash, request_id: cmd.request_id }, {});
    return { lesson_id: cmd.lesson_id, version_id: v.version_id, version_number: v.number, content_hash: v.content_hash,
      state_vector: v.state_vector!, review_event_id: ev.review_event_id, from_state: from, to_state: "submitted" } as SnapshotResult;
  }
  async set_mode(cmd: ModeCommand) {
    this.modes.push(cmd);
    this.w.log.push(`collab:set_mode:${cmd.mode}:${cmd.state}`);
    if (this.mode_behave) await this.mode_behave(cmd);
    return {} as never;
  }
  apply_edit = nope("apply_edit") as never;
  get all_calls() { return this.submits.length + this.modes.length; }
}

export const collab_unavailable = (command: "lock_and_snapshot" | "set_mode") => new CollabUnavailable({ lesson_id: LID, command });

// Rules read the marker in the SNAPSHOT lesson title: [Q] blocking resolvable, [C] confirmation, [S] safety flag, [R] rights.
const finding = (kind: CheckKind, level: CheckFinding["level"], address: string): CheckFinding =>
  ({ kind, level, message: `synthetic ${kind}`, address, span_anchor: null, related_lesson_id: null, code: null });
const rule = (kind: CheckKind, level: CheckFinding["level"], mark: string, address: string) => ({
  kind, level,
  run: (ctx: { lesson: StoredLesson }) => (ctx.lesson.title.includes(mark) ? [finding(kind, level, address)] : []),
});
export const TEST_RULES = [
  rule("quote_without_source", "blocking", "[Q]", "A1"),
  rule("standard_confirmation", "confirmation", "[C]", "A2"),
  rule("safety_flag_open", "blocking", "[S]", "A3"),
  rule("rights_to_clear", "blocking", "[R]", "A4"),
] as unknown as CheckRuleList;
export const RESOLVE_Q = { kind: "quote_without_source" as CheckKind, address: "A1", code: null };
export const RESOLVE_S = { kind: "safety_flag_open" as CheckKind, address: "A3", code: null };
export const RESOLVE_R = { kind: "rights_to_clear" as CheckKind, address: "A4", code: null };

export class StubLoader {
  calls: Array<{ lesson_id: LessonId; lesson: StoredLesson; content_hash: string }> = [];
  async load(lesson_id: LessonId, lesson: StoredLesson, content_hash: string) {
    this.calls.push({ lesson_id, lesson, content_hash });
    return { lesson_id, content_hash, lesson } as never;
  }
}

export interface BuildOpts { state?: LessonRow["state"] | null; four_eyes?: boolean; submit_title?: string | null; submit_vec?: string }

// A world whose latest snapshot is the submit the approver reads (title carries the marker the rules look for).
export function build(opts: BuildOpts = {}) {
  const w = new World(opts.state === undefined ? "submitted" : opts.state);
  if (opts.submit_title !== null && w.lesson !== null && opts.state !== "in_review") w.add_version("submit", opts.submit_title ?? "clean", HASH, opts.submit_vec ?? VEC);
  const clock = new FakeClock(T0);
  const states = new MemStates(w);
  const versions = new MemVersions(w);
  const collab = new RecordingCollab(w);
  const tx = new RecordingTx(w);
  const loader = new StubLoader();
  const settings = { four_eyes_enabled: opts.four_eyes ?? true };
  const metrics = {
    async write_first_approval(lesson_id: LessonId, v: LessonVersionRow, rating: string, _tx: Tx) {
      await tick();
      if (w.metrics.some((m) => m.lesson_id === lesson_id)) return { written: false, active_minutes: null, human_sessions: 0 };
      w.metrics.push({ lesson_id, version_id: v.version_id, rating });
      w.log.push("metrics");
      return { written: true, active_minutes: 1, human_sessions: 1 };
    },
  };
  const graph = { dependencies: async () => w.deps, dependants: nope("dependants"), source_outline_version: nope("sov") };
  const issues = { resolutions_for: async () => w.recorded };
  const suggestions = { pending_for: async () => Array.from({ length: w.pending_suggestions }, () => ({})) };
  const approvals = new ApproveService(
    states, versions, graph as never, issues as never, suggestions as never, loader as never,
    metrics as never, tx, clock, settings as never, TEST_RULES,
  );
  const log = make_log();
  const transitions = new TransitionService(states, versions, approvals, collab, tx, log.logger as never);
  const resolver: SessionResolver = {
    async require(token: string | null, request_id: string) {
      const p = token === null ? undefined : PEOPLE[token as Token];
      if (!p) throw new FixtureRefusal("UNAUTHENTICATED", "Sign in again.");
      return { ...p, request_id } as RequestUser;
    },
  };
  const with_route = make_with_route({
    sessions: () => resolver, logger: log.logger,
    settings: { app_origin: APP_ORIGIN, busy_retry_after_s: 2, session_cookie_name: "ls_session" },
  });
  const handlers = make_transition_handlers({ with_route, transitions: () => transitions as never });
  async function post(token: Token | null, body: unknown, o: { lesson?: string; origin?: string | null } = {}): Promise<HttpResponse> {
    const headers: Record<string, string | undefined> = {};
    if (o.origin !== null) headers["origin"] = o.origin ?? APP_ORIGIN;
    const req: HttpRequest = {
      method: "POST", path_params: { lessonId: o.lesson ?? LID }, query: {}, headers,
      body: body as never, cookies: token === null ? {} : { ls_session: token },
    };
    return handlers.transition_lesson(req);
  }
  return { w, collab, loader, transitions, approvals, handlers, post, lines: log.lines, log, tx, states, versions };
}

export const approve_body = (over: Record<string, unknown> = {}) =>
  ({ action: "approve", snapshot_hash: HASH, snapshot_state_vector: VEC, rating: "usable_with_edits", ...over });
export const code_of = (r: HttpResponse) => (r.body as { error?: { code?: string } } | null)?.error?.code;
export const details_of = (r: HttpResponse) => (r.body as { error: { details: Record<string, unknown> } }).error.details;
