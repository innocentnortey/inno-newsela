// NL-119: seeding, sessions and the socket client for the Yjs load script. Not exported from the package.
// The raw-client pattern below is duplicated on purpose from apps/web/e2e/integration/con-12/socket.ts:
// tools do not import each other (as load/errors.ts does for the same reason).
// Logs nothing. A session token is only ever put in a Cookie header; it never reaches a log line.
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import type { Actor, Sha256, UserId } from "@ls/core/ports/common";
import type { Clock } from "@ls/core/ports/clock";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { PgDatabase } from "@ls/db/pool";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgSessionRepo } from "@ls/db/repos/sessions";
import { insert_row } from "@ls/db/testing/insert-row";
import { Tx as DbTx } from "@ls/db/tx";
import type { StoredLesson } from "@ls/schema/lesson";

export const LOAD_UNIT_ID = "G6.U9";
export const LOAD_LESSON_PREFIX = "G6.U9.L9";
const SYSTEM_ACTOR: Actor = { user_id: null, name: "system", role: null, synthetic: true };

export class NotLoadLesson extends Error {
  constructor(readonly lesson_id: string) {
    super(`refusing to touch a lesson outside the load unit: ${lesson_id}`);
    this.name = "NotLoadLesson";
  }
}

/** Every seed and every socket open goes through this: the demo unit can never be written by the load script. */
export function assert_load_lesson(lesson_id: string): void {
  if (!lesson_id.startsWith(LOAD_LESSON_PREFIX)) throw new NotLoadLesson(lesson_id);
}

export const load_lesson_id = (index: number): string => `${LOAD_LESSON_PREFIX}${String(index + 1).padStart(2, "0")}`;

const wp1 = (): StoredLesson =>
  JSON.parse(readFileSync(new URL("../packages/ydoc/tests/fixtures/stored-wp1.json", import.meta.url), "utf8")) as StoredLesson;

export interface SupportDeps {
  db: PgDatabase;
  ids: IdGenerator;
  clock: Clock;
}

const LOAD_OUTLINE_VERSION_ID = `${LOAD_UNIT_ID}.ov1`;

/**
 * NL-127 follow-up F-B: CheckContextLoader needs the unit's outline version and the lesson's outline row, or every
 * worker check on a load lesson throws InvariantViolation and is retried forever. Writes only the load unit. Idempotent.
 */
async function seed_outline_row(q: DbTx, lesson_id: string, index: number): Promise<void> {
  assert_load_lesson(lesson_id);
  await q.query("insert into unit (id, grade, title) values ($1, 6, 'Synthetic load unit') on conflict (id) do nothing", [LOAD_UNIT_ID]);
  await q.query(
    `insert into outline_version (id, unit_id, number, sha256, same_as_version, source_kind, source_name, uploaded_by, confirmed_at)
     values ($1, $2, 1, $3, null, 'synthetic', 'load-fixture', 'system', now()) on conflict (id) do nothing`,
    [LOAD_OUTLINE_VERSION_ID, LOAD_UNIT_ID, "0".repeat(64)],
  );
  const insert = (row_number: number, kind: string, row_lesson_id: string | null, codes: unknown, hash: string) =>
    q.query(
      `insert into outline_row (outline_version_id, row_number, kind, lesson_id, segments_json, codes_json, findings_json, row_hash)
       values ($1, $2, $3, $4, '[]'::jsonb, $5::jsonb, '[]'::jsonb, $6) on conflict do nothing`,
      [LOAD_OUTLINE_VERSION_ID, row_number, kind, row_lesson_id, JSON.stringify(codes), hash],
    );
  await insert(0, "meta", null, { unit_as_written: LOAD_UNIT_ID, unit_from_filenames: null, unit_rules: [], counts: {} }, "m".repeat(64));
  await insert(
    900 + index + 1,
    "lesson",
    lesson_id,
    {
      focus_codes: [],
      eld_codes: [],
      msls_codes: [],
      vocabulary: [],
      meta: { number: 900 + index + 1, title: "Synthetic load lesson", lesson_type: "Reading", arc: null, homework: null, pages: null, text_set: null },
    },
    "r".repeat(64),
  );
}

/** Idempotent: a lesson id that already exists is left alone. Returns the ids, in order. */
export async function seed_load_lessons(deps: SupportDeps, count: number): Promise<string[]> {
  const store = new PgLessonDocStore({
    ...deps,
    checks: new PgCheckQueue(deps),
    states: new PgLessonRepo(deps),
    audit: new PgAuditLog(deps),
  });
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = load_lesson_id(i);
    assert_load_lesson(id);
    ids.push(id);
    await deps.db.with_tx(async (tx) => {
      const q = tx as DbTx;
      await seed_outline_row(q, id, i);
      const have = await q.query("select 1 from lesson where id = $1", [id]);
      if (have.rows.length > 0) return;
      await insert_row(q, "lesson", {
        id,
        unit_id: LOAD_UNIT_ID,
        number: 900 + i + 1,
        type: "Reading",
        title: "Synthetic load lesson",
        state: "in_review",
        schema_version: 1,
        last_editor_id: null,
      });
      await store.seed_initial(id, { ...wp1(), lesson_id: id }, SYSTEM_ACTOR, tx);
    });
  }
  return ids;
}

export interface Reviewer {
  user_id: string;
  cookie: string; // "<name>=<token>"; never logged
}

export const session_cookie_name = (env: NodeJS.ProcessEnv = process.env): string => env["SESSION_COOKIE_NAME"] ?? "ls_session";
const sha256hex = (s: string): Sha256 => createHash("sha256").update(s).digest("hex") as Sha256;

/** One synthetic reviewer plus a two-hour session per editor. */
export async function create_reviewers(deps: SupportDeps, run_tag: string, count: number): Promise<Reviewer[]> {
  const repo = new PgSessionRepo(deps);
  const name = session_cookie_name();
  const out: Reviewer[] = [];
  await deps.db.with_tx(async (tx) => {
    for (let i = 0; i < count; i += 1) {
      const user_id = `load-rev-${run_tag}-${i}`;
      await insert_row(tx as DbTx, "app_user", {
        id: user_id,
        name: `Synthetic load reviewer ${i}`,
        email: `load-rev-${run_tag}-${i}@example.test`,
        role: "reviewer",
        synthetic: true,
      });
      const token = randomBytes(32).toString("hex");
      await repo.create_session(user_id as UserId, sha256hex(token), new Date(deps.clock.now().getTime() + 2 * 3_600_000), tx);
      out.push({ user_id, cookie: `${name}=${token}` });
    }
  });
  return out;
}

/** The users stay (synthetic); their sessions go. */
export async function delete_sessions(deps: SupportDeps, reviewers: readonly Reviewer[]): Promise<void> {
  if (reviewers.length === 0) return;
  await deps.db.with_tx(async (tx) => {
    await (tx as DbTx).query("delete from app_session where user_id = any($1::text[])", [reviewers.map((r) => r.user_id)]);
  });
}

/** Latest stored state of a lesson, section text joined. "" when the lesson has no stored document. */
export async function stored_text(db: PgDatabase, lesson_id: string): Promise<string> {
  const bytes = await db.with_tx(async (tx) => {
    const { rows } = await (tx as DbTx).query<{ ydoc_bytes: Buffer }>(
      "select ydoc_bytes from lesson_doc where lesson_id = $1 order by seq desc limit 1",
      [lesson_id],
    );
    return rows[0]?.ydoc_bytes;
  });
  if (bytes === undefined) return "";
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, new Uint8Array(bytes));
    return section_text(doc);
  } finally {
    doc.destroy();
  }
}

export const section_addresses = (doc: Y.Doc): string[] => doc.getArray<string>("section_order").toArray();
export function section_text(doc: Y.Doc): string {
  return section_addresses(doc)
    .map((a) => doc.getXmlFragment("section:" + a).toString())
    .join("");
}

/** The first paragraph element anywhere under a section fragment, depth first. */
export function first_paragraph(node: Y.XmlFragment | Y.XmlElement): Y.XmlElement | null {
  for (const child of node.toArray()) {
    if (child instanceof Y.XmlElement) {
      if (child.nodeName === "paragraph") return child;
      const inner = first_paragraph(child);
      if (inner) return inner;
    }
  }
  return null;
}

/** Append a token as text inside the first paragraph of the first section. One transaction. */
export function append_token(doc: Y.Doc, token: string): boolean {
  const address = section_addresses(doc)[0];
  if (address === undefined) return false;
  const paragraph = first_paragraph(doc.getXmlFragment("section:" + address));
  if (paragraph === null) return false;
  doc.transact(() => {
    const last = paragraph.get(paragraph.length - 1);
    if (last instanceof Y.XmlText) last.insert(last.length, token);
    else paragraph.insert(paragraph.length, [new Y.XmlText(token)]);
  });
  return true;
}

export interface SocketClient {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  /** Every WebSocket this client has created (first open plus reconnects). */
  sockets: WebSocket[];
  destroy(): void;
}
export interface ClientHooks {
  onSynced?: () => void;
  onDown?: () => void;
  onStateless?: (message: Record<string, unknown>) => void;
  onSocketCreated?: () => void;
}

export function connect_client(collab_url: string, lesson_id: string, cookie: string, hooks: ClientHooks): SocketClient {
  assert_load_lesson(lesson_id);
  const sockets: WebSocket[] = [];
  class CookieWS extends WebSocket {
    constructor(u: string | URL) {
      super(u, { headers: { cookie } } as never);
      sockets.push(this);
      hooks.onSocketCreated?.();
    }
  }
  const doc = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: collab_url,
    name: `lesson:${lesson_id}`,
    token: "cookie",
    document: doc,
    WebSocketPolyfill: CookieWS,
    onSynced: () => hooks.onSynced?.(),
    onClose: () => hooks.onDown?.(),
    onDisconnect: () => hooks.onDown?.(),
    onStateless: ({ payload }: { payload: string }) => {
      try {
        hooks.onStateless?.(JSON.parse(payload) as Record<string, unknown>);
      } catch {
        /* not ours */
      }
    },
  } as never);
  return { doc, provider, sockets, destroy: () => provider.destroy() };
}
