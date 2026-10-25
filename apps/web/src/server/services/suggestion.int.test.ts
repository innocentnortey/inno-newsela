// @vitest-environment node
// NL-116 AC-8 (risk::security): only the selected text, the note and the lesson's own context reach the model.
// Real wire_assist on a real test database, the stub model client recording every request. Synthetic data only.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { load_web_settings } from "@ls/config/settings";
import type { Actor, RequestUser } from "@ls/core/ports/common";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { locked_hash, LOCKED_DIR } from "@ls/prompts/locked";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { StubModelClient } from "@ls/llm/stub";
import { create_logger } from "@ls/obs/logger";
import type { StoredLesson } from "@ls/schema/lesson";
import type { WebDeps } from "../deps.ts";
import { wire_assist } from "../wiring/assist.ts";

const SENTINEL = "ASSIST-NEIGHBOUR-SENTINEL-4";
const CANARY = "CANARY-KEY-NL116-7c1e9a2b44d05f";
const SELECTED = "Synthetic literacy lab text.";
const NOTE = "Make this clearer for a sixth grader.";
const SYSTEM: Actor = { user_id: null, name: "system", role: null, synthetic: true };
const STORED_WP1 = resolve(import.meta.dirname, "../../../../../packages/ydoc/tests/fixtures/stored-wp1.json");

let t: TestDb;
let stub: StubModelClient;
let lines: string[];
let user: RequestUser;
let result: { suggestion_id: string } | undefined;
const had_key = process.env["ANTHROPIC_API_KEY"];

beforeAll(async () => {
  process.env["ANTHROPIC_API_KEY"] = CANARY;
  t = await create_test_db();
  const clock = new SystemClock();
  const ids = new PrefixedIdGenerator();
  const deps = { db: t.db, ids, clock };
  lines = [];
  const logger = create_logger({ service: "web", build_id: "test", write: (l: string) => void lines.push(l) });
  stub = new StubModelClient({ clock });
  const settings = load_web_settings({
    DATABASE_URL: t.url,
    AUDIT_HASH_SALT: "unused-test-salt-0000000000000000",
    COLLAB_INTERNAL_TOKEN: "unused-test-token-000000000000000",
  });

  await t.db.with_tx(async (tx) => {
    await new PgPromptRepo(deps).sync_locked_layer(locked_hash(LOCKED_DIR), tx);
    await insert_row(tx, "app_user", { id: "usr_reviewer_nl116", email: "reviewer.nl116@example.test", name: "Rae Reviewer", role: "reviewer", synthetic: true });
  });
  user = { user_id: "usr_reviewer_nl116", name: "Rae Reviewer", role: "reviewer", synthetic: true } as unknown as RequestUser;

  const store = new PgLessonDocStore({ ...deps, checks: new PgCheckQueue(deps), states: new PgLessonRepo(deps), audit: new PgAuditLog(deps) });
  const wp1 = JSON.parse(readFileSync(STORED_WP1, "utf8")) as StoredLesson;
  for (const [id, number, text] of [
    ["G6.U4.L4", 4, null],
    ["G6.U4.L5", 5, SENTINEL],
  ] as const) {
    await t.db.with_tx(async (tx) => {
      await insert_row(tx, "lesson", { id, unit_id: "G6.U4", number, type: "Reading", title: "Synthetic WP-1 lesson", state: "in_review", schema_version: 1, last_editor_id: null });
      const lesson = structuredClone({ ...wp1, lesson_id: id }) as StoredLesson;
      if (text !== null) {
        const para = (lesson.sections[0]!.content as { content: { content: { text: string }[] }[] }).content[0]!;
        para.content[0]!.text = `${text} neighbour lesson text`;
      }
      await store.seed_initial(id, lesson, SYSTEM, tx);
    });
  }

  const d = { settings, logger, db: t.db, ids, clock, model_client: stub } as unknown as WebDeps;
  const { suggestions } = wire_assist(d);
  result = await suggestions.request(user, "G6.U4.L4" as never, {
    anchor: { start: "AAAA", end: "AAAB" },
    selected_text: SELECTED,
    note: NOTE,
  } as never);
}, 120_000);

afterAll(async () => {
  if (had_key === undefined) delete process.env["ANTHROPIC_API_KEY"];
  else process.env["ANTHROPIC_API_KEY"] = had_key;
  await t?.drop();
});

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe("prompt_scope", () => {
  it("prompt_scope: the rendered assist prompt contains no neighbour-lesson text", async () => {
    expect(result?.suggestion_id).toBeTruthy();
    expect(stub.calls).toHaveLength(1);
    const sent = stub.calls.flatMap((c) => [...c.system_blocks, ...c.user_blocks]).map((b) => b.text).join("\n");
    expect(sent).toContain(SELECTED);
    expect(sent).toContain(NOTE);
    expect(count(sent, SENTINEL)).toBe(0);
    const rows = (await t.db.with_tx((tx) => tx.query("select * from model_call"))).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(count(JSON.stringify(rows), SENTINEL)).toBe(0);
  });

  it("prompt_scope: a canary provider key in the environment appears nowhere", async () => {
    const dump = async (table: string) => JSON.stringify((await t.db.with_tx((tx) => tx.query(`select * from ${table}`))).rows);
    const all = [
      lines.join("\n"),
      JSON.stringify(stub.calls),
      await dump("suggestion"),
      await dump("model_call"),
      await dump("audit_event"),
    ].join("\n");
    expect(count(all, CANARY)).toBe(0);
    expect(count(all, "CANARY-KEY")).toBe(0);
  });
});
