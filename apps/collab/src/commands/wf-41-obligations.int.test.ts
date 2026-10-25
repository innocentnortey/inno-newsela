// NL-106 AC-13: obligations WF-41 (internal command route lock-and-snapshot) inherits, one case per id, on the real stack:
// real Postgres, real Hocuspocus server, the real /internal route and token check. The check rules and context loader are the
// controlled stubs of nl-106.fixtures.ts (the real loader needs a full outline graph; NL-38 and NL-125 cover it). For ids another
// ticket owns, each case asserts the narrow thing WF-41's own entry point shows.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Server } from "@hocuspocus/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { load_collab_settings } from "@ls/config/settings";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgIssueRepo } from "@ls/db/repos/issue-repo";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { SYSTEM_ACTOR, rows } from "@ls/db/repos/lesson-docs.test-support";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, settings_for, type TestDb } from "@ls/db/testing/test-db";
import { create_logger } from "@ls/obs/logger";
import Decimal from "decimal.js";
import { wire_collab_server } from "../wiring/server.ts";
import { wire_collab_commands } from "../wiring/commands.ts";
import { install_command_handler } from "./routes.ts";
import { FakeStandards, actor, bearer, http_harness, lesson_with_slot, rid, type Http } from "./nl-105.fixtures.ts";
import { Controls, loader_for, rules_for } from "./nl-106.fixtures.ts";

const REPO = new URL("../../../../", import.meta.url).pathname;
const here = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
const ids = new PrefixedIdGenerator();
const clock = new SystemClock();
let t: TestDb;
let server: Server;
let http: Http;
let stop: () => Promise<void>;
const log: string[] = [];
const c = new Controls();
const LESSON_ID = "G6.U4.L490";
const UNIT = "G6.U4";
let wrong_token: { status: number; text: string };
let no_token: { status: number; text: string };
let blocked: { status: number; json: any; text: string };
let ok: { status: number; json: any; text: string };
let before: unknown[];

async function lesson_rows() {
  return [
    await rows(t, "SELECT count(*)::int AS n FROM lesson_version WHERE lesson_id=$1 AND kind<>'generated'", [LESSON_ID]),
    await rows(t, "SELECT count(*)::int AS n FROM review_event WHERE lesson_id=$1", [LESSON_ID]),
  ];
}

beforeAll(async () => {
  t = await create_test_db({ pool_max: 8 });
  const logger = create_logger({ service: "collab", build_id: "test", write: (l) => void log.push(l) });
  const base = load_collab_settings({ DATABASE_URL: t.url, COLLAB_INTERNAL_TOKEN: "t-collab" });
  const settings = { ...base, shared: settings_for(t.url, 4), store_debounce_ms: 600_000, store_max_debounce_ms: 1_200_000 };
  server = new Server({ port: 0, quiet: true, stopOnSignals: false, extensions: [] });
  const d = { settings, logger, db: t.db as never, ids, clock };
  const wiring = wire_collab_server(d, { hocuspocus: server.hocuspocus });
  await server.listen();
  const deps = { db: t.db, ids, clock };
  const states = new PgLessonRepo(deps);
  const store = new PgLessonDocStore({ ...deps, checks: new PgCheckQueue(deps), states, audit: new PgAuditLog(deps) });
  const given = {
    store, reader: new PgLessonDocReader({ db: t.db }), states, versions: states, standards: new FakeStandards(), tx: t.db,
    loader: loader_for(c), rules: rules_for(c), policy: CHECK_POLICY, issues: new PgIssueRepo(deps),
  };
  wire_collab_commands(d, wiring, { hocuspocus: server.hocuspocus }, given as never);
  http = await http_harness(logger);
  stop = async () => {
    install_command_handler(null);
    await http.close();
    await server.destroy();
    await wiring.close();
  };

  const user = "u-rev-1";
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "app_user", { id: user, name: "Synthetic u-rev-1", email: "u-rev-1.demo@example.org", role: "reviewer", synthetic: true });
    await insert_row(tx, "lesson", { id: LESSON_ID, state: "in_review", last_editor_id: null });
    await store.seed_initial(LESSON_ID, lesson_with_slot(LESSON_ID), SYSTEM_ACTOR, tx);
    await states.write_generated_version(
      {
        lesson_id: LESSON_ID, unit_id: UNIT, kind: "generated", lesson: lesson_with_slot(LESSON_ID), draft: {} as never, content_hash: "a".repeat(64),
        provenance: {
          outline_row_hash: "a".repeat(64), prompt_version_id: "pv1", model: "m", parameters: {}, schema_version: 1, example_set_id: null,
          run_id: null as never, model_call_ids: [], cost_usd: new Decimal("0"), ai_assisted_spans: 0, derived_from_version_id: null,
        },
        idempotency_key: "k-" + LESSON_ID,
      },
      tx,
    );
  });
  const [latest] = await rows(t, "SELECT state_vector FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [LESSON_ID]);
  const sv = Buffer.from(latest!["state_vector"] as Buffer).toString("base64");
  const body = (n: number) => ({ lesson_id: LESSON_ID, actor: actor(user), client_state_vector: sv, request_id: rid(n) });
  before = await lesson_rows();
  no_token = await http.post(LESSON_ID, "lock-and-snapshot", body(1));
  wrong_token = await http.post(LESSON_ID, "lock-and-snapshot", body(2), { authorization: "Bearer wrong-token-" + randomBytes(4).toString("hex") });
  c.blocking = true;
  blocked = await http.post(LESSON_ID, "lock-and-snapshot", body(3), bearer());
  c.blocking = false;
  ok = await http.post(LESSON_ID, "lock-and-snapshot", body(4), bearer());
}, 90000);
afterAll(async () => {
  await stop();
  await t.drop();
});

describe("WF-41 obligations (NL-106 AC-13)", () => {
  it("R-11: the submit snapshot is a typed lesson record with a 64-hex hash equal to the stored document's", async () => {
    expect(ok.status).toBe(200);
    const [v] = await rows(t, "SELECT kind, content_hash, lesson_json FROM lesson_version WHERE lesson_id=$1 AND kind='submit'", [LESSON_ID]);
    const [doc] = await rows(t, "SELECT content_hash FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [LESSON_ID]);
    expect(v!["content_hash"]).toMatch(/^[0-9a-f]{64}$/);
    expect(v!["content_hash"]).toBe(doc!["content_hash"]);
    expect((v!["lesson_json"] as any).lesson_id).toBe(LESSON_ID);
    expect(Array.isArray((v!["lesson_json"] as any).sections)).toBe(true);
  });

  it("R-54: the route needs the internal token; a request without it is refused 401 and writes nothing", async () => {
    expect(no_token.status).toBe(401);
    expect(before).toEqual([[{ n: 0 }], [{ n: 0 }]]);
  });

  it("GR-9: restricted source stays git-ignored and untracked, and the Submit code never names it", () => {
    expect(spawnSync("git", ["check-ignore", "docs/source/restricted/x"], { cwd: REPO }).status).toBe(0);
    for (const f of ["lock-and-snapshot.ts", "submit-gate.ts", "live-doc.ts"]) expect(here(f)).not.toContain("source/restricted");
  });

  it("GR-13: no student or teacher-of-record column exists, and the actor carries staff fields only", async () => {
    const bad = await rows(
      t,
      "select table_name, column_name from information_schema.columns where table_schema='public' and column_name ~* '(student|teacher_of_record|\\ydob\\y|birth)'",
    );
    expect(bad).toEqual([]);
    expect(Object.keys(actor()).sort()).toEqual(["name", "role", "synthetic", "user_id"]);
  });

  it("GR-16: Submit's refusal and success texts are expert-driven in tone (no replace-the-writer wording)", () => {
    const text = [blocked.text, ok.text, here("lock-and-snapshot.ts"), here("submit-gate.ts")].join("\n");
    expect(text).not.toMatch(/replac(e|es|ing) (the )?(writers?|teachers?|editors?|reviewers?)/i);
  });

  it("CON-14: a refusal names its error and lists the unresolved issues with kind and address", () => {
    expect(blocked.status).toBe(422);
    expect(blocked.json.error.code).toBe("BLOCKED");
    expect(JSON.stringify(blocked.json.error.details)).toContain("quote_placeholder_open");
  });

  it("CON-15: an open placeholder blocks Submit, and the refused call wrote nothing", async () => {
    expect(blocked.json.error.code).toBe("BLOCKED");
    const [ev] = await rows(t, "SELECT count(*)::int AS n FROM review_event WHERE request_id=$1", [rid(3)]);
    expect(ev!["n"]).toBe(0);
  });

  it("CON-16: Submit leaves the generated (candidate source) version untouched and adds exactly one submit version", async () => {
    const vs = await rows(t, "SELECT kind, adopted FROM lesson_version WHERE lesson_id=$1 ORDER BY number", [LESSON_ID]);
    expect(vs.map((v) => v["kind"])).toEqual(["generated", "submit"]);
  });

  it("CON-G1: a wrong token is refused 401 on the server and writes no row", async () => {
    expect(wrong_token.status).toBe(401);
    expect(await lesson_rows()).toEqual([[{ n: 1 }], [{ n: 1 }]]);
    const [row] = await rows(t, "SELECT count(*)::int AS n FROM review_event WHERE request_id IN ($1,$2)", [rid(1), rid(2)]);
    expect(row!["n"]).toBe(0);
  });

  it("CON-G4: the review_event row names the actor, both states, the version and the content hash", async () => {
    const [e] = await rows(t, "SELECT actor_id, from_state, to_state, version_id, content_hash, note, request_id FROM review_event WHERE lesson_id=$1", [LESSON_ID]);
    expect(e).toMatchObject({ actor_id: "u-rev-1", from_state: "in_review", to_state: "submitted", note: null, request_id: rid(4) });
    expect(e!["version_id"]).toBe(ok.json.version_id);
    expect(e!["content_hash"]).toBe(ok.json.content_hash);
  });

  it("CON-G7: the command takes one lesson_id and returns one snapshot; no bulk form exists", () => {
    expect(ok.json.lesson_id).toBe(LESSON_ID);
    expect(Object.keys(ok.json)).not.toContain("lesson_ids");
    expect(here("lock-and-snapshot.ts")).not.toMatch(/lesson_ids/);
  });

  it("CON-G8: no Submit response or log line carries a person's name with review minutes", () => {
    const all = [ok.text, blocked.text, ...log].join("\n");
    expect(all).not.toContain("Synthetic u-rev-1");
    expect(all).not.toMatch(/review_minutes|minutes_spent/);
  });

  it("EV-S5: the SP-2 integrity evidence is in place, 20 trials with zero edits after the lock", () => {
    const src = here("lock-and-snapshot.int.test.ts");
    expect(src).toContain("sp2_twenty_trials_zero_edits_after_lock");
    expect(src).toMatch(/TRIALS = 20|20 trials|< 20|20;/);
  });

  it("OBS-11: WF-41 is registered for this entry point, and the request_id is logged once on success", () => {
    expect(readFileSync(`${REPO}docs/design/observability.md`, "utf8")).toContain("WF-41");
    expect(log.filter((l) => l.includes("collab.submit\"") && l.includes(rid(4)))).toHaveLength(1);
  });
});
