// @vitest-environment node
// NL-25 AC-12 (capture, WF-1 test_signin_capture): through the route handlers. Frozen; see the NL-25 manifest.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EMAIL, PASSWORD, ROLES, SALT, make_harness, sha256_hex, web_env, type Harness } from "../../../src/server/http/testing/session-harness.ts";
import { code_of, req, token_of } from "../../../src/server/http/testing/route-kit.ts";

const holder = vi.hoisted(() => ({ services: null as unknown }));
vi.mock("../../../src/server/container.ts", () => ({ getServices: () => holder.services }));

let h: Harness;
let route: { POST(r: Request): Promise<Response> };
beforeAll(async () => {
  h = await make_harness();
  Object.assign(process.env, web_env(h.t.url));
  holder.services = { sessions: h.service, logger: h.logger };
  route = (await import("./route.ts")) as typeof route;
}, 30000);
afterAll(async () => {
  await h.drop();
});

describe("test_signin_capture (WF-1)", () => {
  it("each role leaves a session row and a sign_in audit event; an unknown email leaves only a hashed log line", async () => {
    for (const role of ROLES) {
      const res = await route.POST(req("POST", { body: { email: EMAIL[role], password: PASSWORD[role] } }));
      expect(res.status).toBe(200);
      const hash = sha256_hex(token_of(res));
      expect(await h.count("app_session", "token_hash=$1 AND user_id=$2", [hash, h.user_ids[role]])).toBe(1);
      expect(await h.count("audit_event", "action='session.sign_in' AND actor_id=$1 AND target_id=$2", [h.user_ids[role], hash.slice(0, 16)])).toBe(1);
    }
    const sessions = await h.count("app_session");
    const audits = await h.count("audit_event");
    expect([sessions, audits]).toEqual([3, 3]);

    const unknown = "capture-unknown.person@example.test";
    const l = h.lines.length;
    const res = await route.POST(req("POST", { body: { email: unknown, password: "pw-capture-unknown" } }));
    expect(res.status).toBe(403);
    expect(await code_of(res)).toBe("NOT_ON_ALLOW_LIST");

    expect(await h.count("app_session")).toBe(sessions);
    expect(await h.count("audit_event")).toBe(audits);
    const hashed = sha256_hex(SALT + unknown.toLowerCase());
    const refusal_lines = h.lines.slice(l).filter((x) => x.includes(hashed));
    expect(refusal_lines).toHaveLength(1);
    expect(refusal_lines[0]).toContain("NOT_ON_ALLOW_LIST");
    expect(refusal_lines[0]).toMatch(/req_[0-9A-Z]{26}/);
    expect(h.lines.join("\n")).not.toContain(unknown);
    expect(h.lines.join("\n")).not.toContain("capture-unknown");
    expect(await h.all_rows_text()).not.toContain("capture-unknown");

    console.log(`[WF-1 capture] app_session=${sessions} audit_event=${audits} refusal_log=${refusal_lines[0]}`);
  });
});
