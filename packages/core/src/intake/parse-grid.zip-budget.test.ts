import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { load_issued_grid, load_issued_xlsx_bytes } from "../../tests/fixtures/outline/index.ts";
import { IntakeError } from "./errors.ts";
import { parse_workbook } from "./parse-grid.ts";

interface Opts {
  method?: number;
  declared_usize?: number;
  local_usize?: number;
}

/** One-entry zip. Central and local headers declare `declared_usize` (default: tiny), whatever `payload` really is. */
function zip(compressed: Uint8Array, opts: Opts): Uint8Array {
  const name = new TextEncoder().encode("xl/worksheets/sheet1.xml");
  const method = opts.method ?? 8;
  const usize = opts.declared_usize ?? 10;
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(opts.local_usize ?? usize, 22);
  local.writeUInt16LE(name.length, 26);
  name.forEach((b, i) => local.writeUInt8(b, 30 + i));
  const cd = Buffer.alloc(46 + name.length);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(method, 10);
  cd.writeUInt32LE(compressed.length, 20);
  cd.writeUInt32LE(usize, 24);
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt32LE(0, 42);
  name.forEach((b, i) => cd.writeUInt8(b, 46 + i));
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(local.length + compressed.length, 16);
  return new Uint8Array(Buffer.concat([local, compressed, cd, eocd]));
}

const refusal = (fn: () => unknown): IntakeError => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(IntakeError);
    return e as IntakeError;
  }
  throw new Error("expected a refusal");
};

describe("zip budget on actual inflated bytes", () => {
  it("refuses a bomb whose central and local headers declare tiny sizes", () => {
    const bomb = deflateRawSync(Buffer.alloc(2_000_000)); // ~2 KB compressed
    const err = refusal(() => parse_workbook(zip(bomb, {}), "xlsx", { max_zip_uncompressed_bytes: 100_000 }));
    expect(err.code).toBe("UNSUPPORTED_FILE");
    expect(err.details.reason).toBe("too_large");
    expect(JSON.stringify(err.details)).not.toMatch(/xl\//);
  });

  it("refuses when declared and actual sizes disagree but the budget holds", () => {
    const small = deflateRawSync(Buffer.alloc(5_000));
    const err = refusal(() => parse_workbook(zip(small, { declared_usize: 10 }), "xlsx"));
    expect(err.details.reason).toBe("not_csv_or_xlsx");
  });

  it("refuses when the local header disagrees with the central directory", () => {
    const small = deflateRawSync(Buffer.alloc(5_000));
    const err = refusal(() => parse_workbook(zip(small, { declared_usize: 5_000, local_usize: 7 }), "xlsx"));
    expect(err.details.reason).toBe("not_csv_or_xlsx");
  });

  it("refuses unsupported compression methods", () => {
    const err = refusal(() => parse_workbook(zip(new Uint8Array(20), { method: 12, declared_usize: 20 }), "xlsx"));
    expect(err.details.reason).toBe("not_csv_or_xlsx");
  });

  it("still parses a normal XLSX", () => {
    expect(parse_workbook(load_issued_xlsx_bytes(), "xlsx").rows).toEqual(load_issued_grid().rows);
  });
});
