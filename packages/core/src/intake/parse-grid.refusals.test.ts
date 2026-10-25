// FROZEN with NL-16 (risk::security), AC-2: untrusted files are refused fast. Do not edit.
// Ticket verify id `parse-grid.test.ts::refusals` lives here because the implementer owns parse-grid.test.ts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntakeError } from "./errors.ts";
import { parse_workbook } from "./parse-grid.ts";
import { bytes, xlsx_bytes, xlsx_bytes_from_sheet, zip_declaring } from "./testing/frozen-fixtures.ts";

function refusal(fn: () => unknown): IntakeError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(IntakeError);
    return e as IntakeError;
  }
  throw new Error("expected IntakeError, nothing thrown");
}

function timed(fn: () => unknown): { err: IntakeError; ms: number } {
  const t = performance.now();
  const err = refusal(fn);
  return { err, ms: performance.now() - t };
}

describe("refusals", () => {
  it("refusals: [boundary] a PDF is refused as not_csv_or_xlsx in < 2 s", () => {
    const pdf = bytes("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n");
    const { err, ms } = timed(() => parse_workbook(pdf, "csv"));
    expect(err.code).toBe("UNSUPPORTED_FILE");
    expect(err.details.reason).toBe("not_csv_or_xlsx");
    expect(ms).toBeLessThan(2000);
    expect(refusal(() => parse_workbook(pdf, "xlsx")).details.reason).toBe("not_csv_or_xlsx");
  });

  it("refusals: [boundary] an empty file is refused as empty in < 2 s", () => {
    for (const kind of ["csv", "xlsx"] as const) {
      const { err, ms } = timed(() => parse_workbook(new Uint8Array(0), kind));
      expect(err.code).toBe("UNSUPPORTED_FILE");
      expect(err.details.reason).toBe("empty");
      expect(ms).toBeLessThan(2000);
    }
  });

  it("refusals: [boundary] an XLSX declaring a million-cell range is refused as too_large in < 2 s", () => {
    const data = xlsx_bytes_from_sheet({ "!ref": "A1:K100000", A1: { t: "s", v: "x" } });
    const { err, ms } = timed(() => parse_workbook(data, "xlsx"));
    expect(err.code).toBe("UNSUPPORTED_FILE");
    expect(err.details.reason).toBe("too_large");
    expect(ms).toBeLessThan(2000);
  });

  it("refusals: [boundary] a 70-column sheet is refused as too_large in < 2 s", () => {
    const row = Array.from({ length: 70 }, (_, i) => `c${i}`);
    const data = xlsx_bytes([row, row]);
    const { err, ms } = timed(() => parse_workbook(data, "xlsx"));
    expect(err.code).toBe("UNSUPPORTED_FILE");
    expect(err.details.reason).toBe("too_large");
    expect(ms).toBeLessThan(2000);
  });

  it("refusals: [invariant] a formula cell is read as its stored value text, never evaluated", () => {
    const data = xlsx_bytes_from_sheet({ "!ref": "A1:A1", A1: { t: "n", v: 2, f: "1+1" } });
    const grid = parse_workbook(data, "xlsx");
    expect(grid.rows[0]?.[0]).toBe("2");
    const csv = parse_workbook(bytes("=1+1,x\n"), "csv");
    expect(csv.rows[0]?.[0]).toBe("=1+1");
    const asText = parse_workbook(
      xlsx_bytes_from_sheet({ "!ref": "A1:A1", A1: { t: "s", v: "=1+1" } }),
      "xlsx",
    );
    expect(asText.rows[0]?.[0]).toBe("=1+1");
  });
});

describe("hardening", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hardening: [boundary] over the byte cap is too_large before any parser runs", () => {
    // Garbage that would be not_csv_or_xlsx if a parser or magic sniff ran first.
    const big = new Uint8Array(5_242_881).fill(0x41);
    for (const kind of ["csv", "xlsx"] as const) {
      expect(refusal(() => parse_workbook(big, kind)).details.reason).toBe("too_large");
    }
  });

  it("hardening: [boundary] a zip declaring 60 MiB uncompressed is too_large without inflating", () => {
    const z = zip_declaring(60 * 1024 * 1024);
    const { err, ms } = timed(() => parse_workbook(z, "xlsx"));
    expect(err.details.reason).toBe("too_large");
    expect(ms).toBeLessThan(2000);
  });

  it("hardening: [boundary] legacy .xls (OLE2) bytes are refused as xlsx", () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    expect(refusal(() => parse_workbook(ole, "xlsx")).details.reason).toBe("not_csv_or_xlsx");
    expect(refusal(() => parse_workbook(ole, "csv")).details.reason).toBe("not_csv_or_xlsx");
  });

  it("hardening: [boundary] an unknown kind string is refused", () => {
    expect(refusal(() => parse_workbook(bytes("a,b\n"), "xls" as never)).details.reason).toBe("not_csv_or_xlsx");
  });

  it("hardening: [invariant] sheet names __proto__ / constructor / prototype are refused and nothing is polluted", () => {
    const before = Object.getOwnPropertyNames(Object.prototype).sort();
    for (const name of ["__proto__", "constructor", "prototype"]) {
      const data = xlsx_bytes([["a", "b"], ["1", "2"]], name);
      expect(refusal(() => parse_workbook(data, "xlsx")).details.reason).toBe("not_csv_or_xlsx");
    }
    expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(before);
    expect(({} as Record<string, unknown>)["a"]).toBeUndefined();
  });

  it("hardening: [boundary] a CSV with an unterminated quote is refused", () => {
    expect(refusal(() => parse_workbook(bytes('a,"b\nc,d\n'), "csv")).details.reason).toBe("not_csv_or_xlsx");
  });

  it("hardening: [boundary] a CSV over 20,000 cells is too_large; exactly 20,000 is accepted", () => {
    const row = (n: number) => Array.from({ length: n }, () => "x").join(",");
    const over = Array.from({ length: 2001 }, () => row(10)).join("\n"); // 20,010 cells
    expect(refusal(() => parse_workbook(bytes(over), "csv")).details.reason).toBe("too_large");
    const ok = Array.from({ length: 2000 }, () => row(10)).join("\n"); // 20,000 cells
    expect(parse_workbook(bytes(ok), "csv").rows.length).toBe(2000);
  });

  it("hardening: [boundary] a CSV over 60 columns is too_large", () => {
    const wide = Array.from({ length: 61 }, () => "x").join(",");
    expect(refusal(() => parse_workbook(bytes(wide + "\n" + wide), "csv")).details.reason).toBe("too_large");
  });

  it("hardening: [invariant] refusals never log and never echo cell text in message or details", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const planted = "SECRET_CELL_TEXT_9137";
    const cases: Array<() => unknown> = [
      () => parse_workbook(bytes(`${planted},"unterminated\n`), "csv"),
      () => parse_workbook(bytes(`%PDF-1.7 ${planted}`), "csv"),
      () => parse_workbook(xlsx_bytes([[planted]], "__proto__"), "xlsx"),
      () => parse_workbook(xlsx_bytes_from_sheet({ "!ref": "A1:K100000", A1: { t: "s", v: planted } }), "xlsx"),
    ];
    for (const c of cases) {
      const err = refusal(c);
      expect(err.message).not.toContain(planted);
      expect(JSON.stringify(err.details)).not.toContain(planted);
    }
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});
