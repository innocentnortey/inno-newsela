// @vitest-environment node
// NL-26 (implementer-written): error mapping, filing, listing, real-index counts, name sanitising.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IntakeError } from "@ls/core/intake/errors";
import { normalize_outline } from "@ls/core/intake/normalize";
import { StandardsIndex, load_eld_verdicts, load_standard_rows } from "@ls/core/intake/standards-index";
import { insert_row } from "@ls/db/testing/insert-row";
import { load_issued_grid } from "../../../../../packages/core/tests/fixtures/outline/index.ts";
import { count_changed_lessons, detect_kind, refuse_from_intake, sanitize_source_name, unit_key } from "./outline-service.ts";
import { csv_with_snippet, issued_csv_bytes, issued_csv_text, make_stack, type Stack } from "./testing/outline-harness.ts";

let s: Stack;
beforeAll(async () => {
  s = await make_stack();
}, 60_000);
afterAll(async () => {
  await s?.drop();
});
const enc = (t: string) => new TextEncoder().encode(t);
const file = (data: Uint8Array, filename = "a.csv") => ({ filename, content_type: "text/csv", data });

describe("NL-26 service", () => {
  it("intake_errors_become_refusals: header-less CSV, 201 rows, PDF bytes", async () => {
    await expect(s.service.upload(s.author, file(enc("a,b,c\n1,2,3\n")), null)).rejects.toMatchObject({ name: "DomainRefusal", code: "HEADER_NOT_FOUND" });
    const pdf = new Uint8Array(100);
    pdf.set(enc("%PDF-1.4"));
    await expect(s.service.upload(s.author, file(pdf), null)).rejects.toMatchObject({ code: expect.stringMatching(/UNSUPPORTED_FILE|HEADER_NOT_FOUND/) });
    const e = refuse_from_intake(new IntakeError("TOO_MANY_ROWS", { max_rows: 200, rows: 201 }));
    expect(e).toMatchObject({ code: "TOO_MANY_ROWS", details: { max_rows: 200, rows: 201 } });
    expect(refuse_from_intake(new IntakeError("UNSUPPORTED_FILE", { reason: "too_large" })).details).toEqual({ reason: "too_large" });
  });

  it("unit_from_sheet_wins: a sheet with no unit and no argument is INVALID_REQUEST", async () => {
    const text = issued_csv_text().replace(/G6\.U4/g, "").replace(/U4/g, "");
    await expect(s.service.upload(s.author, file(enc(text)), null)).rejects.toBeDefined();
  });

  it("list_newest_first_with_latest_run", async () => {
    await s.service.upload(s.author, file(issued_csv_bytes()), null);
    await s.service.upload(s.author, file(csv_with_snippet("Students retell the story in order")), null);
    await s.tdb.db.with_tx((tx) => insert_row(tx, "run", { id: "run_01", unit_id: "G6.U4", state: "running" }));
    const list = await s.service.list_units(s.author);
    const u = list.units.find((x) => x.unit_id === "G6.U4")!;
    expect(u.unit_key).toBe("g6-u4");
    expect(u.versions.map((v) => v.version_number)).toEqual([2, 1]);
    expect(u.versions[0]!.changed_lessons).toBe(1);
    expect(u.versions[1]!.changed_lessons).toBe(0);
    expect(u.versions[0]!.created_by).toBe("Test author");
    expect(u.latest_run).toEqual({ run_id: "run_01", state: "running" });
  });

  it("real_index_counts: measured 2026-10-25; CON-3 says 7 ELD mismatches, the real index finds 9 distinct codes", () => {
    const rows = load_standard_rows();
    const real = normalize_outline(load_issued_grid(), StandardsIndex.from_rows(rows, load_eld_verdicts()), 200);
    const nonexistent = new Set(real.findings.filter((f) => f.kind === "nonexistent_code").map((f) => f.row_number));
    expect([...nonexistent].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([30, 34, 39]);
    const codes = new Set<string>();
    for (const f of real.findings.filter((x) => x.kind === "eld_mismatch"))
      for (const m of f.original_text.matchAll(/ELD\.P(?:I|II)\.\d+\.?\d*[a-z]?/g)) codes.add(m[0]);
    expect([...codes].sort()).toEqual(
      ["ELD.PI.6.2", "ELD.PI.6.4", "ELD.PI.6.5", "ELD.PI.6.6", "ELD.PI.6.7", "ELD.PII.6.1", "ELD.PII.6.3", "ELD.PII.6.5", "ELD.PII.6.6"],
    );
    const none = normalize_outline(load_issued_grid(), StandardsIndex.from_rows(rows), 200);
    expect(none.findings.filter((f) => f.kind === "eld_mismatch")).toHaveLength(0);
  });

  it("source_name_sanitized and helpers", () => {
    expect(sanitize_source_name("../../etc/x.csv")).toBe("x.csv");
    expect(sanitize_source_name("a\\b\\<c>.csv")).toBe("c.csv");
    expect(sanitize_source_name("..")).toBe("upload");
    expect(sanitize_source_name("x".repeat(200)).length).toBe(80);
    expect(unit_key("G6.U4")).toBe("g6-u4");
    expect(detect_kind(new Uint8Array([0x50, 0x4b, 3, 4]))).toBe("xlsx");
    expect(detect_kind(enc("a,b"))).toBe("csv");
    expect(count_changed_lessons({ a: "1", b: "2" }, { a: "1", b: "3", c: "4" })).toBe(2);
  });
});
