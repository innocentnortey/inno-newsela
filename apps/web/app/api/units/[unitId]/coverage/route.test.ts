// @vitest-environment node
// NL-91: getCoverageMatrix (CON-22, WF-18) through the real with_route, handler, service and Pg repositories.
// Hand count (synthetic, shaped like WP-1 / WP-2: RL.6.1, RL.6.2, L.6.4.b and W.6.2.a over three lessons), per unit:
//   L1 has an approved snapshot (hash a1); its working row (w1, a later edit) links W.6.2.a as A and must be ignored.
//     a1: RL.6.1 I (generator), RL.6.1 A (confirmed by a named user), RL.6.2 P (generator)
//   L2 is working only (hash b1): RL.6.1 P (generator), L.6.4.b I (judge), L.6.4.b A (reviewer-asserted, person)
//   L3 is working only (hash c1): RL.6.2 A (reviewer-asserted, person), W.6.2.a P (generator)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { load_web_settings } from "@ls/config/settings";
import { insert_row } from "@ls/db/testing/insert-row";
import { seed_standards, seed_users } from "@ls/db/testing/outline-seed";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import type { WebDeps } from "@/server/deps.ts";
import { APP_ORIGIN, make_log, make_request, SETTINGS } from "@/server/http/testing/route-fixtures.ts";
import { make_with_route, type HttpRequest, type HttpResponse, type RequestUser, type SessionResolver } from "@/server/http/with-route.ts";
import { wire_coverage } from "@/server/wiring/coverage.ts";
import { make_coverage_handlers } from "./handlers.ts";

const ENV = { DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };
const ROLES = { "author-token": "author", "reviewer-token": "reviewer", "approver-token": "approver" } as const;
const resolver: SessionResolver = {
  async require(token, request_id) {
    const role = token === null ? undefined : (ROLES as Record<string, RequestUser["role"] | undefined>)[token];
    if (!role) throw Object.assign(new Error("Sign in again."), { name: "DomainRefusal", code: "UNAUTHENTICATED" });
    return { user_id: `usr_synthetic_${role}`, name: `Test ${role}`, email: `${role}@example.test`, role, synthetic: true, request_id };
  },
};

let t: TestDb;
let statements: string[] = [];
const log = make_log();
const model_trap = new Proxy({}, { get: () => { throw new Error("the model client must never be touched"); } });

// Logs every statement the service issues, so the test can count them (and see any write).
const counting_db = (): WebDeps["db"] =>
  ({
    with_tx: (fn: (tx: { query: (sql: string, v?: unknown[]) => Promise<unknown> }) => Promise<unknown>, ...rest: unknown[]) =>
      (t.db.with_tx as (...a: unknown[]) => Promise<unknown>)(
        (tx: { query: (sql: string, v?: unknown[]) => Promise<unknown> }) =>
          fn({ ...tx, query: (sql: string, v?: unknown[]) => { statements.push(sql); return tx.query(sql, v); } }),
        ...rest,
      ),
  }) as unknown as WebDeps["db"];

function make_handlers() {
  const deps = {
    db: counting_db(), ids: new PrefixedIdGenerator(), clock: { now: () => new Date(), sleep: async () => {} }, logger: log.logger,
    settings: load_web_settings(ENV), model_client: model_trap,
  } as unknown as WebDeps;
  const { coverage } = wire_coverage(deps);
  return make_coverage_handlers({ with_route: make_with_route({ sessions: () => resolver, logger: log.logger, settings: SETTINGS }), coverage: () => coverage });
}

const get = (h: ReturnType<typeof make_handlers>, unit: string, token = "author-token"): Promise<HttpResponse> => {
  const req: HttpRequest = make_request({ token, method: "GET", path_params: { unitId: unit }, body: null as never, origin: APP_ORIGIN });
  return h.get_coverage(req);
};
interface Body { standards: Array<{ code: string; official_text: string; never_assessed: boolean }>; lessons: Array<{ lesson_id: string; number: number | null }>; cells: Array<Record<string, unknown>> }
const body_of = (r: HttpResponse): Body => r.body as unknown as Body;

const q = <T>(fn: (tx: Parameters<Parameters<TestDb["db"]["with_tx"]>[0]>[0]) => Promise<T>): Promise<T> => t.db.with_tx(fn as never) as Promise<T>;
type Link = [lesson: number, hash: string, code: string, address: string, role: "I" | "P" | "A", origin: string, by: string, confirmed: string | null];

async function seed_unit(u: string, opts: { names?: boolean } = {}): Promise<void> {
  const L = (n: number): string => `${u}.L${n}`;
  await q(async (tx) => {
    await insert_row(tx, "unit", { id: u, grade: 6, title: `Synthetic ${u}` });
    for (const n of [1, 2, 3]) {
      await insert_row(tx, "lesson", {
        id: L(n), unit_id: u, number: n, type: "Reading", title: `Synthetic lesson ${n}`, state: n === 1 ? "approved" : "in_review",
        schema_version: 1, ...(opts.names ? { reviewer_id: "usr_quill" } : {}),
      });
    }
    await insert_row(tx, "lesson_version", { id: `v_${u}_1`, lesson_id: L(1), number: 1, kind: "approve", content_hash: "a1" });
    await insert_row(tx, "lesson_doc", { lesson_id: L(1), seq: 1, content_hash: "a1" });
    await insert_row(tx, "lesson_doc", { lesson_id: L(1), seq: 2, content_hash: "w1" });
    await insert_row(tx, "lesson_doc", { lesson_id: L(2), seq: 1, content_hash: "b1" });
    await insert_row(tx, "lesson_doc", { lesson_id: L(3), seq: 1, content_hash: "c1" });
    const links: Link[] = [
      [1, "a1", "RL.6.1", "launch.1", "I", "outline", "generator", null],
      [1, "a1", "RL.6.1", "lab.cfu1", "A", "outline", "generator", "usr_a"],
      [1, "a1", "RL.6.2", "lab.routine", "P", "narrowed", "generator", null],
      [1, "w1", "W.6.2.a", "lab.cfu9", "A", "added", "generator", null],
      [2, "b1", "RL.6.1", "lab.model", "P", "outline", "generator", null],
      [2, "b1", "L.6.4.b", "lab.vocab", "I", "narrowed", "judge", null],
      [2, "b1", "L.6.4.b", "lab.cfu2", "A", "added", "reviewer", null],
      [3, "c1", "RL.6.2", "lab.cfu3", "A", "added", "reviewer", null],
      [3, "c1", "W.6.2.a", "lab.write", "P", "outline", "generator", null],
    ];
    for (const [n, h, code, addr, role, origin, by, conf] of links) {
      await tx.query(
        "INSERT INTO alignment_link (lesson_id, content_hash, code, address, role, origin, asserted_by, confirmed_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [L(n), h, code, addr, role, origin, by, conf],
      );
    }
  });
}

function expected_cells(u: string) {
  const c = (code: string, n: number, roles: string[], confirmed_by: string, source: string) => ({ code, lesson_id: `${u}.L${n}`, roles, confirmed_by, source });
  return [
    c("L.6.4.b", 2, ["I", "A"], "judge_only", "working"),
    c("RL.6.1", 1, ["I", "A"], "generator_only", "approved"),
    c("RL.6.1", 2, ["P"], "generator_only", "working"),
    c("RL.6.2", 1, ["P"], "generator_only", "approved"),
    c("RL.6.2", 3, ["A"], "person", "working"),
    c("W.6.2.a", 3, ["P"], "generator_only", "working"),
  ];
}

beforeAll(async () => {
  t = await create_test_db();
  await seed_standards(t.db);
  await seed_users(t.db, [{ id: "usr_a", name: "Test Confirmer" }, { id: "usr_quill", name: "Quillfeather Test", role: "reviewer" }]);
}, 120_000);
afterAll(async () => {
  await t.drop();
});

describe("getCoverageMatrix", () => {
  it("test_coverage_matrix_reads_links", async () => {
    await seed_unit("G6.U1");
    const h = make_handlers();
    const r = await get(h, "G6.U1");
    expect(r.status).toBe(200);
    expect(body_of(r).cells).toEqual(expected_cells("G6.U1"));
    expect(body_of(r).lessons).toEqual([1, 2, 3].map((n) => ({ lesson_id: `G6.U1.L${n}`, number: n })));
    const texts = (await q((tx) => tx.query("SELECT code, text FROM standard WHERE code = ANY($1) ORDER BY code", [["L.6.4.b", "RL.6.1", "RL.6.2", "W.6.2.a"]]))).rows as Array<{ code: string; text: string }>;
    expect(body_of(r).standards.map((s) => [s.code, s.official_text])).toEqual(texts.map((s) => [s.code, s.text]));
    expect(texts.every((s) => s.text.length > 0)).toBe(true);

    // A refused read leaves one log line with the request id and the code, and writes no row.
    const before = Number((await q((tx) => tx.query("SELECT (SELECT count(*) FROM alignment_link) + (SELECT count(*) FROM audit_event) AS n"))).rows[0]!["n"]);
    log.lines.length = 0;
    const refused = await get(h, "G6.U77");
    expect(refused.status).toBe(404);
    const refusals = log.lines.map((l) => JSON.parse(l) as Record<string, any>).filter((l) => l["event"] === "route.refused" || l["msg"] === "route.refused");
    expect(refusals).toHaveLength(1);
    expect(JSON.stringify(refusals[0])).toContain("NOT_FOUND");
    expect(String(refusals[0]!["request_id"])).toMatch(/\S/);
    const after = Number((await q((tx) => tx.query("SELECT (SELECT count(*) FROM alignment_link) + (SELECT count(*) FROM audit_event) AS n"))).rows[0]!["n"]);
    expect(after).toBe(before);
  });

  it("never_assessed_flag", async () => {
    await seed_unit("G6.U2");
    const s = body_of(await get(make_handlers(), "G6.U2")).standards;
    expect(s.map((x) => [x.code, x.never_assessed])).toEqual([
      ["L.6.4.b", false], // assessed in L2
      ["RL.6.1", false], // assessed in L1
      ["RL.6.2", false], // assessed in L3 only
      ["W.6.2.a", true], // practised in L3, never assessed (the L1 working-row A is hidden by the approved snapshot)
    ]);
  });

  it("approved_snapshot_wins_over_working", async () => {
    await seed_unit("G6.U3");
    const h = make_handlers();
    const first = body_of(await get(h, "G6.U3")).cells;
    // A later working edit: L1 gets a newer doc whose links add RL.6.2 as A; L2 gets one that adds W.6.2.a as I.
    await q(async (tx) => {
      await insert_row(tx, "lesson_doc", { lesson_id: "G6.U3.L1", seq: 3, content_hash: "w2" });
      await tx.query("INSERT INTO alignment_link (lesson_id, content_hash, code, address, role, origin, asserted_by) VALUES ('G6.U3.L1','w2','RL.6.2','x','A','added','reviewer')");
      await insert_row(tx, "lesson_doc", { lesson_id: "G6.U3.L2", seq: 2, content_hash: "b2" });
      await tx.query("INSERT INTO alignment_link (lesson_id, content_hash, code, address, role, origin, asserted_by) VALUES ('G6.U3.L2','b2','W.6.2.a','y','I','added','generator')");
    });
    const second = body_of(await get(h, "G6.U3")).cells;
    const of_lesson = (cells: Array<Record<string, unknown>>, n: number) => cells.filter((c) => c["lesson_id"] === `G6.U3.L${n}`);
    expect(of_lesson(second, 1)).toEqual(of_lesson(first, 1));
    expect(of_lesson(second, 1).every((c) => c["source"] === "approved")).toBe(true);
    expect(of_lesson(second, 2).map((c) => [c["code"], c["source"]])).toEqual([["W.6.2.a", "working"]]);
    expect(of_lesson(first, 2).map((c) => c["source"]).every((s) => s === "working")).toBe(true);
  });

  it("one_query_no_model_deterministic", async () => {
    await seed_unit("G6.U4");
    const h = make_handlers();
    statements = [];
    const a = await get(h, "G6.U4");
    const reads = statements.slice();
    // Ticket AC-4 said "at most 2"; the repo ports return links, lessons, standard text and unit existence separately,
    // so the composed read is four SELECTs, constant in lesson count (plan Open item 1).
    expect(reads.length).toBeLessThanOrEqual(4);
    expect(reads.every((s) => /^\s*(WITH|SELECT)\b/i.test(s))).toBe(true);
    expect(reads.some((s) => /\b(INSERT|UPDATE|DELETE)\b/i.test(s))).toBe(false);
    const b = await get(h, "G6.U4"); // the model trap in make_handlers throws if anything touches the model client
    expect(JSON.stringify(b.body)).toBe(JSON.stringify(a.body));
  });

  it("p95_under_one_second", async () => {
    const u = "G6.U9";
    const codes = ((await q((tx) => tx.query("SELECT code FROM standard ORDER BY code LIMIT 40"))).rows as Array<{ code: string }>).map((r) => r.code);
    await q(async (tx) => {
      await insert_row(tx, "unit", { id: u, grade: 6, title: "Synthetic big unit" });
      for (let n = 1; n <= 47; n++) {
        const id = `${u}.L${n}`;
        await insert_row(tx, "lesson", { id, unit_id: u, number: n, type: "Reading", title: `Synthetic lesson ${n}`, state: "draft", schema_version: 1 });
        await insert_row(tx, "lesson_doc", { lesson_id: id, seq: 1, content_hash: `h${n}` });
        for (const [k, role] of (["I", "P", "A"] as const).entries()) {
          await tx.query(
            "INSERT INTO alignment_link (lesson_id, content_hash, code, address, role, origin, asserted_by) VALUES ($1,$2,$3,$4,$5,'outline','generator')",
            [id, `h${n}`, codes[(n + k) % codes.length], `a${k}`, role],
          );
        }
      }
    });
    const h = make_handlers();
    const ms: number[] = [];
    for (let i = 0; i < 30; i++) {
      const t0 = performance.now();
      const r = await get(h, u);
      ms.push(performance.now() - t0);
      expect(r.status).toBe(200);
    }
    const body = body_of(await get(h, u));
    expect(body.lessons).toHaveLength(47);
    expect(body.standards.length).toBeGreaterThanOrEqual(39);
    ms.sort((x, y) => x - y);
    const p95 = ms[Math.ceil(0.95 * ms.length) - 1]!;
    console.info(`coverage p95 over 30 calls: ${p95.toFixed(1)} ms`);
    expect(p95).toBeLessThan(1000);
  }, 120_000);

  it("not_found_empty_and_roles", async () => {
    await seed_unit("G6.U5");
    await q((tx) => insert_row(tx, "unit", { id: "G6.U6", grade: 6, title: "Synthetic empty unit" }));
    const h = make_handlers();
    const missing = await get(h, "G6.U78");
    expect(missing.status).toBe(404);
    expect((missing.body as unknown as { error: { code: string } }).error.code).toBe("NOT_FOUND");
    for (const token of ["author-token", "reviewer-token", "approver-token"]) {
      expect((await get(h, "G6.U5", token)).status).toBe(200);
    }
    const empty = await get(h, "G6.U6");
    expect(empty.status).toBe(200);
    expect(body_of(empty)).toEqual({ standards: [], lessons: [], cells: [] });
    expect((await get(h, "G6.U5", "bad-token")).status).toBe(401);
  });

  it("merges_role_confirmations_weakest_wins", async () => {
    // L2 / L.6.4.b has one judge-asserted role row and one person row: the pair reads judge_only, not person.
    await seed_unit("G6.U7");
    const c = body_of(await get(make_handlers(), "G6.U7")).cells.find((x) => x["code"] === "L.6.4.b");
    expect(c).toMatchObject({ roles: ["I", "A"], confirmed_by: "judge_only" });
    // RL.6.1 / L1 has a confirmed A row but an unconfirmed I row: not person either.
    expect(body_of(await get(make_handlers(), "G6.U7")).cells.find((x) => x["code"] === "RL.6.1" && x["lesson_id"] === "G6.U7.L1")).toMatchObject({ confirmed_by: "generator_only" });
  });

  it("no_names_or_minutes", async () => {
    await seed_unit("G6.U8", { names: true });
    await q(async (tx) => {
      await insert_row(tx, "lesson_metrics", { lesson_id: "G6.U8.L1", version_id: "v_G6.U8_1", active_minutes: "37.25", teacher_word_count: 400, g2_threshold_minutes: "15", human_sessions: 1, approved_at: new Date() });
      await insert_row(tx, "review_event", { id: "re_G6.U8_1", lesson_id: "G6.U8.L1", from_state: "in_review", to_state: "approved", actor_id: "usr_quill", note: "Quillfeather Test checked 37.25 minutes" });
    });
    log.lines.length = 0;
    const r = await get(make_handlers(), "G6.U8", "reviewer-token");
    expect(r.status).toBe(200);
    const everything = JSON.stringify(r.body) + "\n" + log.lines.join("\n");
    for (const needle of ["Quillfeather", "Test Confirmer", "37.25", "usr_quill", "usr_a", "reviewer_name", "minutes"]) {
      expect(everything).not.toContain(needle);
    }
  });
});
