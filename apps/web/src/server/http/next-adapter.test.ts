// @vitest-environment node
import { describe, expect, it } from "vitest";
import { to_http_request, to_response } from "./next-adapter.ts";

const RID = "req_00000000000000000000000001";
const mk = (init: RequestInit = {}, url = "http://localhost:3000/api/x?a=1&a=2&b=3") => new Request(url, init);

describe("next-adapter", () => {
  it("lower-cases headers, parses cookies and repeated query keys", async () => {
    const r = await to_http_request(mk({ method: "POST", headers: { "X-Thing": "v", cookie: "a=1; b=x%20y; c=%E0" }, body: "{}" }));
    expect(r.headers["x-thing"]).toBe("v");
    expect(r.cookies).toEqual({ a: "1", b: "x y", c: "%E0" });
    expect(r.query).toEqual({ a: ["1", "2"], b: "3" });
    expect(r.body).toEqual({});
  });
  it("malformed or empty JSON gives a null body", async () => {
    expect((await to_http_request(mk({ method: "POST", body: "{nope" }))).body).toBeNull();
    expect((await to_http_request(mk())).body).toBeNull();
  });
  it("keeps a valid request id and mints one otherwise", async () => {
    expect((await to_http_request(mk({ headers: { "x-request-id": RID } }))).headers["x-request-id"]).toBe(RID);
    const minted = (await to_http_request(mk({ headers: { "x-request-id": "bad id!" } }))).headers["x-request-id"];
    expect(minted).toMatch(/^req_[0-9A-Z]{26}$/);
  });
  it("204 has no body; JSON bodies carry content-type; multiple Set-Cookie append", async () => {
    const none = to_response({ status: 204, headers: { "X-Request-Id": RID, "Content-Type": "application/json" }, body: null });
    expect(none.status).toBe(204);
    expect(await none.text()).toBe("");
    const ok = to_response({ status: 200, headers: { "X-Request-Id": RID }, body: { a: 1 } }, { "Set-Cookie": ["a=1", "b=2"] });
    expect(ok.headers.get("content-type")).toBe("application/json");
    expect(await ok.json()).toEqual({ a: 1 });
    expect(ok.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
  });
});
