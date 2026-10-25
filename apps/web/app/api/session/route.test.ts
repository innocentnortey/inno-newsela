// @vitest-environment node
// NL-25 AC-1, AC-2, AC-3, AC-4, AC-6, AC-7: /api/session route handlers. Frozen; see the NL-25 manifest.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  EMAIL, PASSWORD, PW_MARKER, ROLES, SALT, UNKNOWN_EMAIL_MARKER, make_harness, sha256_hex, web_env, type Harness,
} from "../../../src/server/http/testing/session-harness.ts";
import { code_of, req, set_cookie, token_of } from "../../../src/server/http/testing/route-kit.ts";

const holder = vi.hoisted(() => ({ services: null as unknown }));
vi.mock("../../../src/server/container.ts", () => ({ getServices: () => holder.services }));

let h: Harness;
let route: { POST(r: Request): Promise<Response>; GET(r: Request): Promise<Response>; DELETE(r: Request): Promise<Response> };
beforeAll(async () => {
  h = await make_harness();
  Object.assign(process.env, web_env(h.t.url));
  holder.services = { sessions: h.service, logger: h.logger };
  route = (await import("./route.ts")) as typeof route;
}, 30000);
afterAll(async () => {
  await h.drop();
});

const counts = async () => [await h.count("app_session"), await h.count("audit_event")];

describe("sign_in_each_role (AC-1)", () => {
  it.each(ROLES)("invariant: %s signs in: 200 Session, cookie attrs, hashed session row, one audit event", async (role) => {
    const [s0, a0] = await counts();
    const res = await route.POST(req("POST", { body: { email: EMAIL[role], password: PASSWORD[role] } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: Record<string, unknown>; expires_at: string };
    expect(body.user).toEqual({ user_id: h.user_ids[role], name: `Demo ${role}`, email: EMAIL[role], role, synthetic: true });
    expect(body.expires_at).toBe(new Date(h.clock.now().getTime() + 12 * 3600_000).toISOString());
    const sc = set_cookie(res);
    expect(sc).toMatch(/^ls_session=[^;]+/);
    expect(sc).toMatch(/HttpOnly/);
    expect(sc).toMatch(/SameSite=Strict/);
    expect(sc).toMatch(/Path=\//);
    expect(sc).toMatch(/Max-Age=43200/);
    expect(sc).not.toMatch(/Secure/); // APP_ORIGIN is http://localhost
    const token = token_of(res);
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(await h.count("app_session", "token_hash=$1 AND user_id=$2", [sha256_hex(token), h.user_ids[role]])).toBe(1);
    expect(await h.count("app_session", "token_hash=$1", [token])).toBe(0);
    expect(await h.count("app_session")).toBe(s0! + 1);
    expect(await h.count("audit_event")).toBe(a0! + 1);
    expect(await h.count("audit_event", "action='session.sign_in' AND actor_id=$1 AND target_kind='session' AND target_id=$2", [h.user_ids[role], sha256_hex(token).slice(0, 16)])).toBe(1);
  });
});

describe("unknown_email_refused (AC-2)", () => {
  it("refusal: 403 NOT_ON_ALLOW_LIST, one sleep(1000), no rows", async () => {
    const before = await counts();
    const s = h.clock.sleeps.length;
    const res = await route.POST(req("POST", { body: { email: "stranger@example.test", password: "whatever-1" } }));
    expect(res.status).toBe(403);
    expect(await code_of(res)).toBe("NOT_ON_ALLOW_LIST");
    expect(h.clock.sleeps.slice(s)).toEqual([1000]);
    expect(await counts()).toEqual(before);
    expect(set_cookie(res)).toBe("");
  });
});

describe("wrong_password_refused (AC-3)", () => {
  it("refusal: 401 INVALID_CREDENTIALS with the exact message, one sleep, no rows, one hashed-email log line", async () => {
    const before = await counts();
    const s = h.clock.sleeps.length;
    const l = h.lines.length;
    const res = await route.POST(req("POST", { body: { email: EMAIL.author, password: "not-the-password" } }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
    expect(body.error.message).toBe("That email and password don't match");
    expect(h.clock.sleeps.slice(s)).toEqual([1000]);
    expect(await counts()).toEqual(before);
    const hash = sha256_hex(SALT + EMAIL.author.toLowerCase());
    const mine = h.lines.slice(l).filter((x) => x.includes(hash));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toContain("INVALID_CREDENTIALS");
    expect(mine[0]).toMatch(/req_[0-9A-Z]{26}/);
    expect(mine[0]).not.toContain(EMAIL.author);
    expect(mine[0]).not.toContain("not-the-password");
  });
});

describe("no_secret_in_rows_or_logs (AC-4)", () => {
  it("negative: markers and the raw token appear in no table, log line or response body", async () => {
    const bodies: string[] = [];
    const r1 = await route.POST(req("POST", { body: { email: UNKNOWN_EMAIL_MARKER, password: PW_MARKER } }));
    bodies.push(await r1.text());
    const r2 = await route.POST(req("POST", { body: { email: EMAIL.reviewer, password: PW_MARKER } }));
    bodies.push(await r2.text());
    const r3 = await route.POST(req("POST", { body: { email: EMAIL.reviewer, password: PASSWORD.reviewer } }));
    const token = token_of(r3);
    bodies.push(await r3.text());
    expect([r1.status, r2.status, r3.status]).toEqual([403, 401, 200]);
    const tables = await h.all_rows_text();
    const logs = h.lines.join("\n");
    for (const needle of [PW_MARKER, UNKNOWN_EMAIL_MARKER, "nobody-marker-91", token]) {
      expect(needle.length).toBeGreaterThan(5);
      expect(tables).not.toContain(needle);
      expect(logs).not.toContain(needle);
      for (const b of bodies) expect(b).not.toContain(needle);
    }
    expect(bodies[2]).not.toContain(PASSWORD.reviewer);
  });
});

describe("sign_out (AC-6)", () => {
  it("invariant: DELETE revokes, audits once, clears the cookie, and the old cookie is then 401", async () => {
    const login = await route.POST(req("POST", { body: { email: EMAIL.approver, password: PASSWORD.approver } }));
    const token = token_of(login);
    const cookie = `ls_session=${token}`;
    const got = await route.GET(req("GET", { cookie }));
    expect(got.status).toBe(200);
    expect(((await got.json()) as { user: { role: string } }).user.role).toBe("approver");
    const a0 = await h.count("audit_event", "action='session.sign_out'");
    const out = await route.DELETE(req("DELETE", { cookie }));
    expect(out.status).toBe(204);
    expect(set_cookie(out)).toMatch(/^ls_session=;/);
    expect(set_cookie(out)).toMatch(/Max-Age=0/);
    expect(await h.count("app_session", "token_hash=$1 AND revoked_at IS NOT NULL", [sha256_hex(token)])).toBe(1);
    expect(await h.count("audit_event", "action='session.sign_out'")).toBe(a0 + 1);
    const again = await route.GET(req("GET", { cookie }));
    expect(again.status).toBe(401);
    expect(await code_of(again)).toBe("UNAUTHENTICATED");
  });
  it("negative: DELETE without a session is 401 and writes nothing", async () => {
    const before = await counts();
    const res = await route.DELETE(req("DELETE"));
    expect(res.status).toBe(401);
    expect(await code_of(res)).toBe("UNAUTHENTICATED");
    expect(await counts()).toEqual(before);
  });
  it("negative: GET with no cookie or an unknown token is 401", async () => {
    expect((await route.GET(req("GET"))).status).toBe(401);
    expect((await route.GET(req("GET", { cookie: "ls_session=bogus" }))).status).toBe(401);
  });
});

describe("foreign_origin_and_extra_key (AC-7)", () => {
  it("negative: foreign Origin sign-in is 401 UNAUTHENTICATED and creates no session", async () => {
    const before = await counts();
    const res = await route.POST(req("POST", { origin: "https://evil.example.test", body: { email: EMAIL.author, password: PASSWORD.author } }));
    expect(res.status).toBe(401);
    expect(await code_of(res)).toBe("UNAUTHENTICATED");
    expect(await counts()).toEqual(before);
    expect(set_cookie(res)).toBe("");
  });
  it("boundary: extra key synthetic is 400 INVALID_REQUEST and creates no session", async () => {
    const before = await counts();
    const res = await route.POST(req("POST", { body: { email: EMAIL.author, password: PASSWORD.author, synthetic: true } }));
    expect(res.status).toBe(400);
    expect(await code_of(res)).toBe("INVALID_REQUEST");
    expect(await counts()).toEqual(before);
  });
});
