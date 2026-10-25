// @vitest-environment node
// NL-26 frozen tests (risk::security): AC-4, AC-5, AC-6. Do not edit: hashed in docs/plans/frozen-tests/NL-26.manifest.json.
import { describe, expect, it } from "vitest";
import { FakeClock } from "@ls/core/ports/clock";
import { GoogleSheetsExportFetcher } from "./google-sheets.ts";
import {
  FakeSheetTransport,
  SHEET_ID,
  SHEET_URL,
  redirect_response,
  status_response,
} from "./testing/fake-sheet-transport.ts";

const MAX_BYTES = 5 * 1024 * 1024;

function make(transport: FakeSheetTransport, clock = new FakeClock()) {
  return new GoogleSheetsExportFetcher({
    timeout_ms: 10_000,
    max_bytes: MAX_BYTES,
    transport: transport.fn as never,
    clock,
  });
}

async function refusal(p: Promise<unknown>): Promise<{ code: string; message: string; details: any; name: string }> {
  try {
    await p;
  } catch (e) {
    return e as never;
  }
  throw new Error("expected a refusal, but the call succeeded");
}

describe("NL-26 AC-4 unreachable [failure/refusal]", () => {
  it("unreachable: a transport that never answers is SHEET_UNREACHABLE after 10 s on the fake clock", async () => {
    const clock = new FakeClock();
    const transport = new FakeSheetTransport(() => new Promise(() => {}));
    const fetcher = make(transport, clock);
    const settled = refusal(fetcher.fetch_export(SHEET_URL));
    await new Promise((r) => setImmediate(r));
    clock.advance(10_000);
    const err = await settled;
    expect(err.name).toBe("DomainRefusal");
    expect(err.code).toBe("SHEET_UNREACHABLE");
    expect(transport.requests).toHaveLength(1);
  });

  it("unreachable: a network error is SHEET_UNREACHABLE and is not retried", async () => {
    const transport = new FakeSheetTransport(() => Promise.reject(new Error("ECONNRESET")));
    const err = await refusal(make(transport).fetch_export(SHEET_URL));
    expect(err.code).toBe("SHEET_UNREACHABLE");
    expect(transport.requests).toHaveLength(1);
  });

  it("unreachable: a 503 is SHEET_UNREACHABLE, not a private-sheet message", async () => {
    const transport = new FakeSheetTransport(() => status_response(503));
    const err = await refusal(make(transport).fetch_export(SHEET_URL));
    expect(err.code).toBe("SHEET_UNREACHABLE");
  });
});

describe("NL-26 AC-5 no_ssrf [negative]", () => {
  const caller_chosen = [
    "http://169.254.169.254/",
    `https://docs.google.com.evil.example/spreadsheets/d/${SHEET_ID}`,
    `https://user@docs.google.com/spreadsheets/d/${SHEET_ID}`,
    "file:///etc/passwd",
  ];
  for (const url of caller_chosen) {
    it(`no_ssrf: ${url} is refused with INVALID_REQUEST before any request`, async () => {
      const transport = new FakeSheetTransport(() => status_response(200));
      const err = await refusal(make(transport).fetch_export(url));
      expect(["INVALID_REQUEST", "SHEET_NOT_PUBLIC"]).toContain(err.code);
      if (err.code === "INVALID_REQUEST") expect(err.details).toEqual({ fields: ["sheet_url"] });
      expect(transport.requests).toEqual([]);
    });
  }

  it("no_ssrf: a redirect from docs.google.com to https://evil.example/ is SHEET_NOT_PUBLIC and never requested", async () => {
    const transport = new FakeSheetTransport(() => redirect_response("https://evil.example/"));
    const err = await refusal(make(transport).fetch_export(SHEET_URL));
    expect(["INVALID_REQUEST", "SHEET_NOT_PUBLIC"]).toContain(err.code);
    expect(transport.requests).toHaveLength(1);
    expect(transport.hosts().every((h) => h === "docs.google.com")).toBe(true);
  });

  it("no_ssrf: the server builds the export URL itself and drops the caller's query", async () => {
    const transport = new FakeSheetTransport(() => status_response(404));
    await refusal(make(transport).fetch_export(`${SHEET_URL}&export=evil`));
    expect(transport.requests).toEqual([`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`]);
  });
});

describe("NL-26 AC-6 private_sheet [invariant]", () => {
  const cases: Array<[string, () => FakeSheetTransport]> = [
    ["sign-in redirect", () => new FakeSheetTransport(() => redirect_response("https://accounts.google.com/ServiceLogin?continue=x"))],
    ["401", () => new FakeSheetTransport(() => status_response(401))],
    ["403", () => new FakeSheetTransport(() => status_response(403))],
  ];
  for (const [name, build] of cases) {
    it(`private_sheet: ${name} is SHEET_NOT_PUBLIC with the plain message and no stack`, async () => {
      const transport = build();
      const err = await refusal(make(transport).fetch_export(SHEET_URL));
      expect(err.code).toBe("SHEET_NOT_PUBLIC");
      expect(err.message).toContain("share it publicly or upload the file");
      expect(err.message).not.toContain(SHEET_ID);
      expect(err.message).not.toMatch(/\n\s+at /);
      expect(JSON.stringify(err.details ?? {})).not.toContain(SHEET_ID);
      expect(transport.hosts().every((h) => h === "docs.google.com")).toBe(true);
    });
  }
});
