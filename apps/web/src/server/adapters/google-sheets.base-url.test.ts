// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FakeClock } from "@ls/core/ports/clock";
import { GoogleSheetsExportFetcher, parse_sheet_url } from "./google-sheets.ts";
import { FakeSheetTransport, bytes_response, redirect_response } from "./testing/fake-sheet-transport.ts";

const ID = "PUBLICissuedSheet01";
const LOOP = "http://127.0.0.1:4010";
const XLSX = { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

function loop_fetcher(t: FakeSheetTransport) {
  return new GoogleSheetsExportFetcher({ timeout_ms: 10_000, max_bytes: 1024 * 1024, transport: t.fn as never, clock: new FakeClock(), base_url: LOOP });
}
async function code_of(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as { code: string }).code;
  }
  return "OK";
}

describe("base_url seam", () => {
  it("base_url: default base accepts Google and refuses every other origin", () => {
    expect(parse_sheet_url(`https://docs.google.com/spreadsheets/d/${ID}`).export_url).toBe(`https://docs.google.com/spreadsheets/d/${ID}/export?format=xlsx`);
    for (const bad of [
      `http://127.0.0.1:4010/spreadsheets/d/${ID}`,
      `https://docs.google.com.evil.example/spreadsheets/d/${ID}`,
      `https://docs.google.com:8443/spreadsheets/d/${ID}`,
      `https://user:pw@docs.google.com/spreadsheets/d/${ID}`,
      `http://docs.google.com/spreadsheets/d/${ID}`,
    ]) {
      expect(() => parse_sheet_url(bad), bad).toThrow();
    }
  });
  it("base_url: a loopback base builds its own export url", () => {
    const r = parse_sheet_url(`${LOOP}/spreadsheets/d/${ID}/edit`, LOOP);
    expect(r.export_url).toBe(`${LOOP}/spreadsheets/d/${ID}/export?format=xlsx`);
    expect(r.canonical_url).toBe(`${LOOP}/spreadsheets/d/${ID}`);
  });
  it("base_url: a loopback base refuses the other origin and another port", () => {
    expect(() => parse_sheet_url(`https://docs.google.com/spreadsheets/d/${ID}`, LOOP)).toThrow();
    expect(() => parse_sheet_url(`http://127.0.0.1:4011/spreadsheets/d/${ID}`, LOOP)).toThrow();
  });
  it("base_url: the transport only sees the base origin and a same-origin redirect is followed", async () => {
    const t = new FakeSheetTransport((url, i) =>
      i === 0 ? redirect_response(`${LOOP}/spreadsheets/d/${ID}/download`) : bytes_response(200, new Uint8Array([1, 2, 3]), XLSX),
    );
    const out = await loop_fetcher(t).fetch_export(`${LOOP}/spreadsheets/d/${ID}/edit`);
    expect(out.data.byteLength).toBe(3);
    expect(t.requests.every((u) => u.startsWith(`${LOOP}/`))).toBe(true);
    expect(t.requests).toHaveLength(2);
  });
  it("base_url: a redirect off the base origin is SHEET_NOT_PUBLIC", async () => {
    const t = new FakeSheetTransport(() => redirect_response("https://evil.example/"));
    expect(await code_of(loop_fetcher(t).fetch_export(`${LOOP}/spreadsheets/d/${ID}`))).toBe("SHEET_NOT_PUBLIC");
  });
  it("base_url: a same-origin sign-in redirect is SHEET_NOT_PUBLIC", async () => {
    const t = new FakeSheetTransport(() => redirect_response(`${LOOP}/accounts/ServiceLogin`));
    expect(await code_of(loop_fetcher(t).fetch_export(`${LOOP}/spreadsheets/d/${ID}`))).toBe("SHEET_NOT_PUBLIC");
  });
  it("base_url: the default fetcher still follows googleusercontent and refuses other hosts", async () => {
    const ok = new FakeSheetTransport((_u, i) =>
      i === 0 ? redirect_response("https://doc-0g-xyz.googleusercontent.com/export/a") : bytes_response(200, new Uint8Array([9]), XLSX),
    );
    const f = (t: FakeSheetTransport) => new GoogleSheetsExportFetcher({ timeout_ms: 10_000, max_bytes: 1024, transport: t.fn as never, clock: new FakeClock() });
    const url = `https://docs.google.com/spreadsheets/d/${ID}`;
    expect((await f(ok).fetch_export(url)).data.byteLength).toBe(1);
    const bad = new FakeSheetTransport(() => redirect_response(`${LOOP}/spreadsheets/d/${ID}`));
    expect(await code_of(f(bad).fetch_export(url))).toBe("SHEET_NOT_PUBLIC");
  });
});
