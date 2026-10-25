// @vitest-environment node
// NL-26 frozen tests (risk::security): AC-1, AC-3, AC-8, AC-9. Do not edit: hashed in docs/plans/frozen-tests/NL-26.manifest.json.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DomainRefusal } from "@ls/core/errors";
import {
  csv_with_snippet,
  issued_csv_bytes,
  issued_csv_text,
  issued_xlsx_bytes,
  make_stack,
  type Stack,
} from "../../../src/server/services/testing/outline-harness.ts";

let s: Stack;
beforeAll(async () => {
  s = await make_stack();
}, 60_000);
afterAll(async () => {
  await s?.drop();
});

const enc = (t: string) => new TextEncoder().encode(t);
const body_of = (r: { body: unknown }) => r.body as any;
const totals = async () => [await s.count("outline_version"), await s.count("outline_row"), await s.count("audit_event")];

describe("NL-26 AC-1 issued_sheet_twice [invariant]", () => {
  it("issued_sheet_twice: the issued sheet uploaded twice gives two 201s, same sha256, same_as_version 1, changed_lessons 0, unchanged rows", async () => {
    const first = await s.upload(issued_xlsx_bytes(), "issued.xlsx");
    const second = await s.upload(issued_xlsx_bytes(), "issued.xlsx");
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const a = body_of(first);
    const b = body_of(second);
    expect(a.version_number).toBe(1);
    expect(b.version_number).toBe(2);
    expect(b.sha256).toBe(a.sha256);
    expect(b.same_as_version).toBe(1);
    expect(b.changed_lessons).toBe(0);

    const rows1 = await s.repo.rows("G6.U4.ov1");
    const rows2 = await s.repo.rows("G6.U4.ov2");
    expect(rows1.length).toBeGreaterThan(0);
    expect(rows2.map((r) => r.row_hash)).toEqual(rows1.map((r) => r.row_hash));
    // approved plan decision: exactly one meta row per version at row_number 0, never returned by rows()
    for (const id of ["G6.U4.ov1", "G6.U4.ov2"]) {
      const meta = await s.query("select count(*)::int as n from outline_row where outline_version_id = $1 and row_number = 0", [id]);
      expect(meta[0].n).toBe(1);
    }
    expect(rows1.every((r) => r.row.row_number > 0)).toBe(true);
  });
});

describe("NL-26 AC-3 refusals_write_nothing [failure/refusal]", () => {
  const header_line = () => issued_csv_text().split("\n").find((l) => l.startsWith("Filename,Lesson,")) as string;
  const too_many_rows = () => {
    const filler = Array.from({ length: 201 }, (_, i) => `L${i}_ELA_TE_G6_U4_CA_Core,Lesson,Lesson ${i + 1},Core ${i + 1},1.0,N/A,Synthetic description ${i + 1},,,RI.6.1,,,,,,`);
    return enc(['"G6, U4: Synthetic unit"' + ",".repeat(15), header_line(), ...filler].join("\n") + "\n");
  };
  const pdf_like = () => {
    const b = new Uint8Array(2048);
    b.set(enc("%PDF-1.4\n%"), 0);
    return b;
  };

  it("refusals_write_nothing: five refusals, the right 422 each time, and no version, row or audit event written", async () => {
    const before = await totals();
    const cases: Array<[string, () => Promise<any>, string, Record<string, unknown> | null]> = [
      ["not csv/xlsx", () => s.upload(pdf_like(), "report.pdf"), "UNSUPPORTED_FILE", { reason: "type" }],
      ["over 5 MB", () => s.upload(new Uint8Array(5 * 1024 * 1024 + 1).fill(0x61), "big.csv"), "UNSUPPORTED_FILE", { reason: "too_large" }],
      ["no header row", () => s.upload(enc("a,b,c\n1,2,3\n"), "nohead.csv"), "HEADER_NOT_FOUND", null],
      ["over 200 rows", () => s.upload(too_many_rows(), "many.csv"), "TOO_MANY_ROWS", null],
      [
        "private sheet link",
        async () => {
          s.fetcher.next = async () => {
            throw new DomainRefusal("SHEET_NOT_PUBLIC", "This sheet is private; share it publicly or upload the file.", {});
          };
          return s.import_link("https://docs.google.com/spreadsheets/d/synthetic/edit");
        },
        "SHEET_NOT_PUBLIC",
        null,
      ],
    ];
    for (const [name, run, code, details] of cases) {
      const res = await run();
      const b = body_of(res);
      expect(res.status, name).toBe(422);
      expect(b.error.code, name).toBe(code);
      expect(Object.keys(b), name).toEqual(["error"]);
      for (const k of Object.keys(b.error)) expect(["code", "message", "details"], name).toContain(k);
      expect(JSON.stringify(b), name).not.toMatch(/stack|\n\s+at /i);
      if (details) expect(b.error.details, name).toMatchObject(details);
      if (code === "HEADER_NOT_FOUND") expect(Array.isArray(b.error.details.columns_looked_for), name).toBe(true);
      expect(await totals(), name).toEqual(before);
    }
  });
});

describe("NL-26 AC-8 roles [failure/refusal]", () => {
  it("roles: reviewer and approver get 403 ROLE_FORBIDDEN on both POST routes and write nothing", async () => {
    const before = await totals();
    for (const token of ["reviewer-token", "approver-token"]) {
      const up = await s.upload(issued_csv_bytes(), "issued.csv", token);
      expect(up.status, `${token} upload`).toBe(403);
      expect(body_of(up).error.code).toBe("ROLE_FORBIDDEN");
      const imp = await s.import_link("https://docs.google.com/spreadsheets/d/synthetic", token);
      expect(imp.status, `${token} import`).toBe(403);
      expect(body_of(imp).error.code).toBe("ROLE_FORBIDDEN");
    }
    expect(await totals()).toEqual(before);
  });

  it("roles: GET /units is 200 for author, reviewer and approver", async () => {
    for (const token of ["valid-token", "reviewer-token", "approver-token"]) {
      const res = await s.list(token);
      expect(res.status, token).toBe(200);
      expect(Array.isArray(body_of(res).units), token).toBe(true);
    }
  });

  it("roles: an author import with a served sheet is 201 (the gate is the role, not the route)", async () => {
    s.fetcher.serve(issued_xlsx_bytes());
    const res = await s.import_link("https://docs.google.com/spreadsheets/d/synthetic/edit");
    expect(res.status).toBe(201);
  });
});

describe("NL-26 AC-9 hostile_cell_and_filename [negative]", () => {
  it("hostile_cell_and_filename: the cell is stored and returned as inert text and the filename is never a path", async () => {
    const hostile = "<img src=x onerror=alert(1)>";
    const res = await s.upload(csv_with_snippet(hostile), "../../etc/x.csv");
    expect(res.status).toBe(201);
    const b = body_of(res);
    expect(JSON.stringify(res.body)).not.toContain("<img");
    const stored = await s.query("select segments_json::text as s, codes_json::text as c from outline_row where outline_version_id = $1", [b.outline_version_id]);
    expect(stored.some((r) => r.s.includes(hostile) || r.c.includes(hostile))).toBe(true);
    const ver = (await s.query("select source_name from outline_version where id = $1", [b.outline_version_id]))[0];
    expect(ver.source_name).toBe("x.csv");
    expect(ver.source_name).not.toMatch(/\.\.|\//);
    const listed = await s.list();
    expect(JSON.stringify(listed.body)).not.toContain("<img");
    expect(existsSync(resolve(process.cwd(), "x.csv"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "../../etc/x.csv"))).toBe(false);
  });
});
