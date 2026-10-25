// NL-36 frozen tests: AC-9 (refusals_pass_through), AC-10 (unavailable_cases),
// AC-11 (token_never_leaks_and_path_safe). The client takes an injectable fetch; no network.
import { SecretStr } from "@ls/config/secret";
import { FakeClock } from "@ls/core/ports/clock";
import { CollabUnavailable, DomainRefusal, InvariantViolation } from "@ls/core/errors";
import type { EditCommand, ModeCommand, SubmitCommand } from "@ls/core/ports/collab-commands";
import { describe, expect, it } from "vitest";
import { HttpCollabCommandClient, collab_refusal_from } from "./collab-commands.ts";

const MARKER = "TOKEN-MARKER-6612";
const BASE = "http://collab.internal:4100";
const LESSON = "G6.U4.L4";
const WEB_REQ = "req_01HZ0000000000000000000001";
const COLLAB_REQ = "req_01HZ0000000000000000000099";
const USER = "usr_01HZ0000000000000000000002";
const ACTOR = { user_id: USER, name: "Ada Test", role: "reviewer" as const, synthetic: true };

interface Seen { url: string; init: RequestInit }
interface LogLine { level: string; event: string; fields: Record<string, unknown> }

function make_logger() {
  const lines: LogLine[] = [];
  const at = (level: string) => (event: string, fields: Record<string, unknown>) => void lines.push({ level, event, fields });
  return { lines, logger: { info: at("info"), warn: at("warn"), error: at("error") } };
}

function dump(value: unknown): string {
  const seen = new Set<unknown>();
  const walk = (v: unknown): unknown => {
    if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack, own: walk({ ...v }) };
    if (v && typeof v === "object") {
      if (seen.has(v)) return "[cycle]";
      seen.add(v);
      return Array.isArray(v) ? v.map(walk) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

function setup(respond: (url: string, init: RequestInit) => Promise<Response>) {
  const seen: Seen[] = [];
  const fetch_impl = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, init: init ?? {} });
    return respond(url, init ?? {});
  }) as unknown as typeof fetch;
  const clock = new FakeClock(new Date("2026-10-01T10:00:00.000Z"));
  const { lines, logger } = make_logger();
  const client = new HttpCollabCommandClient(
    { base_url: BASE, token: new SecretStr(MARKER), timeout_ms: 5000 },
    { clock, logger: logger as never, fetch_impl },
  );
  return { client, seen, clock, lines };
}

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

const submit = (lesson_id = LESSON): SubmitCommand => ({ lesson_id, actor: ACTOR, client_state_vector: "AQID", request_id: WEB_REQ });
const edit = (lesson_id = LESSON): EditCommand => ({
  lesson_id, actor: ACTOR, tag: "standard-decision", request_id: WEB_REQ,
  edit: { kind: "standard", code: "CCSS.ELA-LITERACY.RL.6.1", decision: "confirm", restore: null },
});
const mode = (lesson_id = LESSON): ModeCommand => ({ lesson_id, mode: "read_only", state: "submitted", request_id: WEB_REQ });

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
}

const envelope = (code: string, message: string, details?: Record<string, unknown>) => ({
  error: { code, message, ...(details ? { details } : {}) },
});

describe("refusals_pass_through [failure/refusal, AC-9]", () => {
  const cases: [string, number, "lock_and_snapshot" | "apply_edit", Record<string, unknown>][] = [
    ["NOT_STORED", 409, "lock_and_snapshot", { reason: "unsaved" }],
    ["BLOCKED", 409, "lock_and_snapshot", { issues: [{ id: "i1", rule: "a" }, { id: "i2", rule: "b" }] }],
    ["LESSON_LOCKED", 409, "apply_edit", { state: "submitted" }],
    ["ANCHOR_CHANGED", 409, "apply_edit", { anchor: "p1" }],
    ["SUGGESTION_PENDING", 409, "lock_and_snapshot", { count: 1 }],
    ["CONFIRMATION_OPEN", 409, "lock_and_snapshot", { count: 2 }],
  ];
  it.each(cases)("%s keeps code, message and details; request_id is the web id; collab id is logged", async (code, status, command, extra) => {
    const message = `${code} message text`;
    const { client, lines, seen } = setup(() => json(status, envelope(code, message, { ...extra, request_id: COLLAB_REQ })));
    const call = command === "apply_edit" ? client.apply_edit(edit()) : client.lock_and_snapshot(submit());
    const err = await call.then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(DomainRefusal);
    const r = err as DomainRefusal;
    expect(r.code).toBe(code);
    expect(r.message).toBe(message);
    expect(r.details).toEqual({ ...extra, request_id: WEB_REQ });
    expect(seen).toHaveLength(1);
    expect(dump(lines)).toContain(COLLAB_REQ);
    const logged = lines.find((l) => (l.fields["extra"] as Record<string, unknown> | undefined)?.["collab_request_id"] === COLLAB_REQ);
    expect(logged).toBeDefined();
  });

  it("[boundary] a refusal without details gets details.request_id set to the web id", () => {
    const e = collab_refusal_from(409, envelope("NOT_STORED", "m"), "lock_and_snapshot", LESSON, WEB_REQ);
    expect(e).toBeInstanceOf(DomainRefusal);
    expect((e as DomainRefusal).details).toMatchObject({ request_id: WEB_REQ });
  });
});

describe("unavailable_cases [failure/refusal, AC-10]", () => {
  it("a 5 s timeout (FakeClock) is COLLAB_UNAVAILABLE after one request", async () => {
    const { client, clock, seen } = setup(() => new Promise<Response>(() => {}));
    const p = client.apply_edit(edit()).then(() => null, (e: unknown) => e);
    await settle();
    clock.advance(5000);
    const err = await p;
    expect(err).toBeInstanceOf(CollabUnavailable);
    expect(err).toMatchObject({ lesson_id: LESSON, command: "apply_edit" });
    expect(seen).toHaveLength(1);
  });

  it("connection refused is COLLAB_UNAVAILABLE after one request", async () => {
    const { client, seen } = setup(() => Promise.reject(new TypeError("fetch failed: ECONNREFUSED")));
    const err = await client.set_mode(mode()).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(CollabUnavailable);
    expect(err).toMatchObject({ lesson_id: LESSON, command: "set_mode" });
    expect(seen).toHaveLength(1);
  });

  it("a 502 with an HTML body is COLLAB_UNAVAILABLE after one request", async () => {
    const { client, seen } = setup(() => Promise.resolve(new Response("<html>Bad Gateway</html>", { status: 502 })));
    const err = await client.lock_and_snapshot(submit()).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(CollabUnavailable);
    expect(seen).toHaveLength(1);
  });

  it("a 200 whose body does not match the result record is COLLAB_UNAVAILABLE after one request", async () => {
    const { client, seen } = setup(() => json(200, { unexpected: true }));
    const err = await client.apply_edit(edit()).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(CollabUnavailable);
    expect(seen).toHaveLength(1);
  });

  it("a 401 (token mismatch) is COLLAB_UNAVAILABLE, logs an InvariantViolation, and is not retried", async () => {
    const { client, lines, seen } = setup(() => json(401, envelope("UNAUTHENTICATED", "denied by collab")));
    const err = await client.lock_and_snapshot(submit()).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(CollabUnavailable);
    expect(err).not.toBeInstanceOf(DomainRefusal);
    expect(seen).toHaveLength(1);
    const found = lines.some((l) => {
      const x = l.fields["extra"];
      return x instanceof InvariantViolation || (typeof x === "object" && x !== null && Object.values(x).some((v) => v instanceof InvariantViolation));
    });
    expect(found).toBe(true);
  });

  it("[boundary] collab_refusal_from maps 401, a non-envelope body and an unknown code to CollabUnavailable", () => {
    for (const [status, body] of [[401, envelope("NOT_STORED", "m")], [500, "<html>"], [409, undefined], [409, envelope("NO_SUCH_CODE", "m")], [409, { error: "x" }]] as const) {
      const e = collab_refusal_from(status, body, "set_mode", LESSON, WEB_REQ);
      expect(e).toBeInstanceOf(CollabUnavailable);
      expect(e).toMatchObject({ lesson_id: LESSON, command: "set_mode" });
    }
  });
});

describe("token_never_leaks_and_path_safe [negative, AC-11]", () => {
  it("the marker is only in the Authorization header: not in url, body, other headers, logs or errors", async () => {
    const all_errors: unknown[] = [];
    const { client, seen, lines } = setup(() => Promise.reject(new TypeError(`fetch failed ${MARKER}`)));
    for (const run of [() => client.lock_and_snapshot(submit()), () => client.apply_edit(edit()), () => client.set_mode(mode())]) {
      all_errors.push(await run().then(() => null, (e: unknown) => e));
    }
    const refusal = setup(() => json(409, envelope("LESSON_LOCKED", "locked", { state: "submitted" })));
    all_errors.push(await refusal.client.apply_edit(edit()).then(() => null, (e: unknown) => e));
    const unauth = setup(() => json(401, envelope("UNAUTHENTICATED", `echo ${MARKER}`)));
    all_errors.push(await unauth.client.set_mode(mode()).then(() => null, (e: unknown) => e));

    expect(seen).toHaveLength(3);
    for (const s of seen) {
      const h = new Headers(s.init.headers);
      expect(h.get("authorization")).toBe(`Bearer ${MARKER}`);
      expect(s.url.startsWith(BASE + "/lessons/")).toBe(true);
      expect(s.url).not.toContain(MARKER);
      expect(String(s.init.body)).not.toContain(MARKER);
      for (const [k, v] of h.entries()) if (k !== "authorization") expect(v).not.toContain(MARKER);
      expect(s.init.method).toBe("POST");
      expect(s.init.redirect).toBe("error");
      expect(h.get("x-request-id")).toBe(WEB_REQ);
    }
    expect(dump(lines)).not.toContain(MARKER);
    expect(dump(unauth.lines)).not.toContain(MARKER);
    expect(dump(refusal.lines)).not.toContain(MARKER);
    expect(dump(all_errors)).not.toContain(MARKER);
    expect(all_errors.every((e) => e instanceof Error)).toBe(true);
  });

  it("a lesson id with / stays one URL-encoded path segment; . and .. are refused before any request", async () => {
    // REFREEZE 2026-10-25 (PD-32): WHATWG URL collapses %2E%2E, so . and .. are refused instead.
    const { client, seen } = setup(() => Promise.reject(new TypeError("down")));
    const ids = ["G6/../../admin", "a/b", "x?y#z"];
    for (const id of ids) await client.apply_edit(edit(id)).then(() => null, () => null);
    for (const id of ["..", "."]) {
      const err = await client.apply_edit(edit(id)).then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(InvariantViolation);
    }
    expect(seen).toHaveLength(ids.length);
    const paths = seen.map((s) => s.url);
    expect(paths[0]).toBe(`${BASE}/lessons/${encodeURIComponent("G6/../../admin")}/apply-edit`);
    expect(paths[1]).toBe(`${BASE}/lessons/a%2Fb/apply-edit`);
    for (const p of paths) {
      const u = new URL(p);
      expect(u.origin).toBe(BASE);
      expect(u.search).toBe("");
      expect(u.hash).toBe("");
      expect(u.pathname.split("/").filter(Boolean)).toHaveLength(3);
    }
  });

  it("[boundary] the three commands use their own route segments", async () => {
    const { client, seen } = setup(() => Promise.reject(new TypeError("down")));
    await client.lock_and_snapshot(submit()).catch(() => null);
    await client.apply_edit(edit()).catch(() => null);
    await client.set_mode(mode()).catch(() => null);
    expect(seen.map((s) => s.url.split("/").pop())).toEqual(["lock-and-snapshot", "apply-edit", "set-mode"]);
  });
});
