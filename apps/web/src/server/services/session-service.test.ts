// @vitest-environment node
// NL-25 AC-5 (invariant): SessionService.require. Frozen; see docs/plans/frozen-tests/NL-25.manifest.json.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EMAIL, PASSWORD, make_harness, sha256_hex, type Harness } from "../http/testing/session-harness.ts";

let h: Harness;
let token: string;
const RID = "req_00000000000000000000000001";
beforeAll(async () => {
  h = await make_harness();
  const out = await h.service.sign_in({ email: EMAIL.reviewer, password: PASSWORD.reviewer }, { request_id: RID, ip_hash: null });
  token = out.cookie_token;
}, 30000);
afterAll(async () => {
  await h.drop();
});

const refused = async (tok: string | null) => {
  const before = [await h.count("app_session"), await h.count("audit_event")];
  await expect(h.service.require(tok, RID)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  expect([await h.count("app_session"), await h.count("audit_event")]).toEqual(before);
};

describe("require_cases (AC-5)", () => {
  it("success: valid token resolves to the RequestUser and get_session returns the Session; writes nothing", async () => {
    const before = [await h.count("app_session"), await h.count("audit_event")];
    const user = await h.service.require(token, RID);
    expect(user).toMatchObject({ user_id: h.user_ids.reviewer, email: EMAIL.reviewer, role: "reviewer", synthetic: true, request_id: RID });
    const session = await h.service.get_session(user);
    expect(session.user).toEqual({ user_id: h.user_ids.reviewer, name: "Demo reviewer", email: EMAIL.reviewer, role: "reviewer", synthetic: true });
    expect(session.expires_at).toBe(new Date(h.clock.now().getTime() + 12 * 3600_000).toISOString());
    expect([await h.count("app_session"), await h.count("audit_event")]).toEqual(before);
  });
  it("boundary: no cookie (null and empty) is UNAUTHENTICATED", async () => {
    await refused(null);
    await refused("");
  });
  it("boundary: unknown token is UNAUTHENTICATED", async () => {
    await refused("not-a-real-token");
  });
  it("revoked session is UNAUTHENTICATED", async () => {
    const out = await h.service.sign_in({ email: EMAIL.author, password: PASSWORD.author }, { request_id: RID, ip_hash: null });
    const user = await h.service.require(out.cookie_token, RID);
    await h.service.sign_out(user, out.cookie_token);
    await refused(out.cookie_token);
  });
  it("expired session (clock past expires_at) is UNAUTHENTICATED; the stored value is the hash, never the token", async () => {
    const out = await h.service.sign_in({ email: EMAIL.approver, password: PASSWORD.approver }, { request_id: RID, ip_hash: null });
    expect(await h.count("app_session", "token_hash=$1", [sha256_hex(out.cookie_token)])).toBe(1);
    expect(await h.count("app_session", "token_hash=$1", [out.cookie_token])).toBe(0);
    await h.service.require(out.cookie_token, RID);
    h.clock.advance(12 * 3600_000 + 1);
    await refused(out.cookie_token);
  });
});
