// NL-80 frozen fixtures: fakes for the collab server tests (no database, no network, no @ls/db import).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as Y from "yjs";
import { FakeClock } from "@ls/core/ports/clock";
import { load_collab_settings, type CollabSettings } from "@ls/config/settings";
import { create_logger, type Logger } from "@ls/obs/logger";
import type { RoleName, LessonStateName } from "@ls/core/ports/common";
import type { AppUserRow, SessionContext, SessionRepo } from "@ls/core/ports/sessions";
import type { LessonRow, LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { LessonDocReader, LessonDocStore, StoredDoc, StoreRequest } from "@ls/core/ports/lesson-docs";
import type { StoreAck } from "@ls/core/ports/collab-commands";
import type { StoredLesson } from "@ls/schema/lesson";
import { lesson_to_ydoc } from "@ls/ydoc/convert";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";

export const LESSON = "G6.U4.L4";
export const DOC_NAME = `lesson:${LESSON}`;
export const COOKIE_VALUE = "COOKIEVALUE-QZ80";
export const SENTENCE = "COLLAB-QZ-80";
export const KEY_MARKER = "sk-ant-COLLAB-MARKER-80";

export const settings = (): CollabSettings =>
  load_collab_settings({ DATABASE_URL: "postgres://u:p@localhost:5432/d", COLLAB_INTERNAL_TOKEN: "t-collab" });

export const wp1 = (): StoredLesson =>
  JSON.parse(readFileSync(new URL("../../../packages/ydoc/tests/fixtures/stored-wp1.json", import.meta.url), "utf8")) as StoredLesson;
export const edited = (n: number): StoredLesson => ({ ...wp1(), title: `${wp1().title} (edit ${n})` });
export const bytes_of = (l: StoredLesson): Uint8Array => lesson_to_ydoc(l);

export const sha256 = (token: string): string => createHash("sha256").update(token).digest("hex");

export const user = (role: RoleName, id = `u-${role}-1`): AppUserRow =>
  ({ user_id: id, email: `${id}.demo@example.org`, name: `Synthetic ${role}`, role, synthetic: true }) as AppUserRow;

export const NOW = new Date("2026-10-25T12:00:00.000Z");
export const clock = (): FakeClock => new FakeClock(NOW);

export type SessionKind = "live" | "expired" | "revoked";
/** Like PgSessionRepo.resolve: expired and revoked sessions resolve to null. */
export class FakeSessions implements SessionRepo {
  resolve_calls = 0;
  private readonly by_hash = new Map<string, { user: AppUserRow; kind: SessionKind }>();
  add(token: string, u: AppUserRow, kind: SessionKind = "live"): void {
    this.by_hash.set(sha256(token), { user: u, kind });
  }
  async resolve(token_hash: string, now: Date): Promise<SessionContext | null> {
    this.resolve_calls += 1;
    const e = this.by_hash.get(token_hash);
    if (e === undefined || e.kind !== "live") return null;
    return {
      user: e.user,
      session: { token_hash, user_id: e.user.user_id, created_at: now, expires_at: new Date(now.getTime() + 3_600_000) },
    } as SessionContext;
  }
  async find_user_by_email(): Promise<never> { throw new Error("unused"); }
  async create_session(): Promise<never> { throw new Error("unused"); }
  async revoke(): Promise<void> { throw new Error("unused"); }
}

export class FakeStates implements LessonStateRepo {
  get_calls = 0;
  constructor(public state: LessonStateName = "in_review") {}
  async get(lesson_id: string): Promise<LessonRow | null> {
    this.get_calls += 1;
    return { lesson_id, unit_id: "G6.U4", number: 4, type: "lesson", title: "t", state: this.state, current_version_id: null,
      reviewer_id: null, last_editor_id: null, schema_version: 1 } as unknown as LessonRow;
  }
  lock_for_update(): never { throw new Error("unused"); }
  state_of(): never { throw new Error("unused"); }
  ensure_lessons(): never { throw new Error("unused"); }
  set_state(): never { throw new Error("unused"); }
  append_review_event(): never { throw new Error("unused"); }
  record_last_editor(): never { throw new Error("unused"); }
}

export class FakeReader implements LessonDocReader {
  latest_calls = 0;
  constructor(public doc: StoredDoc | null = stored_doc()) {}
  async latest(): Promise<StoredDoc | null> { this.latest_calls += 1; return this.doc; }
  latest_derived(): never { throw new Error("unused"); }
}

export function stored_doc(over: Partial<StoredDoc> = {}, lesson: StoredLesson = wp1()): StoredDoc {
  const ydoc_bytes = bytes_of(lesson);
  return { lesson_id: LESSON, seq: 1, store_id: "st_00000000000000000000000001", ydoc_bytes, content_hash: content_hash(lesson),
    state_vector: state_vector_of(ydoc_bytes), schema_version: 1, stored_at: NOW, ...over } as StoredDoc;
}

export class FakeDocStore implements LessonDocStore {
  requests: StoreRequest[] = [];
  fail = false;
  async store(req: StoreRequest): Promise<StoreAck> {
    this.requests.push(req);
    if (this.fail) throw new Error("forced store failure");
    return { lesson_id: req.lesson_id, store_id: `st_${String(this.requests.length).padStart(26, "0")}`, seq: this.requests.length + 1,
      content_hash: req.content_hash, state_vector: req.state_vector, stored_at: NOW, stored_by: req.stored_by,
      check_job_enqueued: true } as StoreAck;
  }
  seed_initial(): never { throw new Error("unused"); }
}

export function capture_logger(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  return { logger: create_logger({ service: "collab", build_id: "test", write: (l) => void lines.push(l) }), lines };
}

// Fake Hocuspocus connection / document, shaped like the members the plan reads.
export class FakeConnection {
  readOnly = false;
  sent: string[] = [];
  constructor(public socketId: string, public context: { ctx: unknown }) {}
  sendStateless(payload: string): void { this.sent.push(payload); }
}
export class FakeDocument extends Y.Doc {
  constructor(public conns: FakeConnection[]) { super(); }
  getConnections(): FakeConnection[] { return this.conns; }
}

// Raw Hocuspocus frame: varString(doc) varUint(type) varUint(sub) varUint8Array(payload)
function var_uint(n: number): number[] {
  const out: number[] = [];
  while (n > 127) { out.push(128 | (n & 127)); n = Math.floor(n / 128); }
  out.push(n);
  return out;
}
function var_string(s: string): number[] {
  const b = new TextEncoder().encode(s);
  return [...var_uint(b.length), ...b];
}
export function sync_frame(doc_name: string, sub: 0 | 1 | 2, payload: Uint8Array): Uint8Array {
  return Uint8Array.from([...var_string(doc_name), ...var_uint(0), ...var_uint(sub), ...var_uint(payload.length), ...payload]);
}
export function awareness_frame(doc_name: string, payload: Uint8Array): Uint8Array {
  return Uint8Array.from([...var_string(doc_name), ...var_uint(1), ...var_uint(payload.length), ...payload]);
}
/** A real Yjs update that inserts `text` (used as the body of a refused edit). */
export function update_with(text: string): Uint8Array {
  const d = new Y.Doc();
  d.getText("scratch").insert(0, text);
  return Y.encodeStateAsUpdate(d);
}
export const sv_b64 = (d: Y.Doc): string => Buffer.from(Y.encodeStateVector(d)).toString("base64");
