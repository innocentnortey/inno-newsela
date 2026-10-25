// @vitest-environment node
// NL-26 (implementer-written): fetcher limits.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GoogleSheetsExportFetcher } from "./google-sheets.ts";
import { FakeSheetTransport, SHEET_ID, SHEET_URL, bytes_response, redirect_response, status_response } from "./testing/fake-sheet-transport.ts";

const make = (t: FakeSheetTransport, max_bytes = 1000) =>
  new GoogleSheetsExportFetcher({ timeout_ms: 10_000, max_bytes, transport: t.fn as never });

describe("NL-26 fetcher limits", () => {
  it("too_large_stream: aborts past max_bytes", async () => {
    const t = new FakeSheetTransport(() => bytes_response(200, new Uint8Array(2000), {}));
    await expect(make(t).fetch_export(SHEET_URL)).rejects.toMatchObject({ code: "UNSUPPORTED_FILE", details: { reason: "too_large" } });
  });
  it("too_large_stream: content-length over the cap is refused before reading", async () => {
    const t = new FakeSheetTransport(() => bytes_response(200, new Uint8Array(10), { "content-length": "5000" }));
    await expect(make(t).fetch_export(SHEET_URL)).rejects.toMatchObject({ details: { reason: "too_large" } });
  });
  it("allowed_redirect_followed: docs.google.com to a googleusercontent doc host, then 200", async () => {
    const t = new FakeSheetTransport((_u, i) =>
      i === 0 ? redirect_response("https://doc-0c-aa-sheets.googleusercontent.com/export/x") : bytes_response(200, new Uint8Array([1, 2, 3]), {}),
    );
    const r = await make(t).fetch_export(SHEET_URL);
    expect(r.data).toEqual(new Uint8Array([1, 2, 3]));
    expect(t.requests).toHaveLength(2);
  });
  it("redirect hop limit: more than 3 hops is SHEET_UNREACHABLE", async () => {
    const t = new FakeSheetTransport(() => redirect_response("https://docs.google.com/spreadsheets/d/x/export"));
    await expect(make(t).fetch_export(SHEET_URL)).rejects.toMatchObject({ code: "SHEET_UNREACHABLE" });
    expect(t.requests.length).toBe(4);
  });
  it("redirect to http or a non-https scheme is SHEET_NOT_PUBLIC and never requested", async () => {
    const t = new FakeSheetTransport(() => redirect_response("http://docs.google.com/x"));
    await expect(make(t).fetch_export(SHEET_URL)).rejects.toMatchObject({ code: "SHEET_NOT_PUBLIC" });
    expect(t.requests).toHaveLength(1);
  });
  it("html_body_is_private", async () => {
    const t = new FakeSheetTransport(() => bytes_response(200, new TextEncoder().encode("<html>"), { "content-type": "text/html; charset=utf-8" }));
    await expect(make(t).fetch_export(SHEET_URL)).rejects.toMatchObject({ code: "SHEET_NOT_PUBLIC" });
  });
  it("five_xx_unreachable and 404 is private", async () => {
    await expect(make(new FakeSheetTransport(() => status_response(500))).fetch_export(SHEET_URL)).rejects.toMatchObject({ code: "SHEET_UNREACHABLE" });
    await expect(make(new FakeSheetTransport(() => status_response(404))).fetch_export(SHEET_URL)).rejects.toMatchObject({ code: "SHEET_NOT_PUBLIC" });
  });
  it("happy_path: builds the export URL and returns the hash", async () => {
    const data = new Uint8Array([9, 8, 7]);
    const t = new FakeSheetTransport(() => bytes_response(200, data, { "content-type": "application/octet-stream" }));
    const r = await make(t).fetch_export(SHEET_URL);
    expect(t.requests).toEqual([`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`]);
    expect(r.kind).toBe("xlsx");
    expect(r.sha256).toBe(createHash("sha256").update(data).digest("hex"));
    expect(r.url).toBe(`https://docs.google.com/spreadsheets/d/${SHEET_ID}`);
  });
  it("bad urls: over-long and not-a-sheet paths are INVALID_REQUEST", async () => {
    const t = new FakeSheetTransport(() => status_response(200));
    await expect(make(t).fetch_export("https://docs.google.com/" + "a".repeat(3000))).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(make(t).fetch_export("https://docs.google.com/document/d/abc")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(t.requests).toEqual([]);
  });
});
