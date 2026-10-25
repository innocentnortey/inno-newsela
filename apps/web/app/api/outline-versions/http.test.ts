// @vitest-environment node
// NL-26 (implementer-written): the Next request adapter.
import { describe, expect, it } from "vitest";
import { UPLOAD_ENVELOPE_BYTES, to_http_request, to_response } from "./http.ts";

const body_of = (r: { body: unknown }) => r.body as { reject: unknown; file: unknown };
const OPTS = { multipart: true, max_file_bytes: 1000 };
const form = (name: string, bytes: Uint8Array, filename = "a.csv") => {
  const f = new FormData();
  f.set(name, new File([bytes as BlobPart], filename, { type: "text/csv" }));
  return f;
};

describe("NL-26 adapter", () => {
  it("multipart_adapter: ok, oversized content-length, and a missing file part", async () => {
    const ok = await to_http_request(new Request("http://x/api", { method: "POST", body: form("file", new Uint8Array([97, 98])) }), OPTS);
    expect(body_of(ok).reject).toBeNull();
    expect(body_of(ok).file).toMatchObject({ filename: "a.csv", data_base64: "YWI=" });
    const big = await to_http_request(
      new Request("http://x/api", { method: "POST", headers: { "content-length": String(1000 + UPLOAD_ENVELOPE_BYTES + 1) }, body: "x" }),
      OPTS,
    );
    expect(body_of(big).reject).toBe("too_large");
    const none = await to_http_request(new Request("http://x/api", { method: "POST", body: form("other", new Uint8Array([1])) }), OPTS);
    expect(body_of(none).reject).toBe("type");
    const over = await to_http_request(new Request("http://x/api", { method: "POST", body: form("file", new Uint8Array(1001)) }), OPTS);
    expect(body_of(over).reject).toBe("too_large");
  });

  it("json_body_capped: valid JSON parses, bad JSON and oversize become null; cookies and query parse", async () => {
    const json = (b: string) => to_http_request(new Request("http://x/api?a=1&a=2", { method: "POST", headers: { cookie: "ls_session=t%20k; z=1", Origin: "o" }, body: b }), { multipart: false, max_file_bytes: 1 });
    const ok = await json('{"sheet_url":"u"}');
    expect(ok.body).toEqual({ sheet_url: "u" });
    expect(ok.query).toEqual({ a: ["1", "2"] });
    expect(ok.cookies).toMatchObject({ ls_session: "t k", z: "1" });
    expect(ok.headers["origin"]).toBe("o");
    expect((await json("{nope")).body).toBeNull();
    expect((await json(JSON.stringify({ x: "a".repeat(9000) }))).body).toBeNull();
  });

  it("to_response serialises the body and status", async () => {
    const r = to_response({ status: 201, headers: { "X-Request-Id": "r" }, body: { a: 1 } });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ a: 1 });
    expect(to_response({ status: 204, headers: {}, body: null }).body).toBeNull();
  });
});
