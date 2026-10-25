// @vitest-environment node
// NL-26 frozen tests (risk::security): AC-2, AC-7. Do not edit: hashed in docs/plans/frozen-tests/NL-26.manifest.json.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { load_standards_index } from "@ls/core/intake/standards-index";
import { normalize_outline } from "@ls/core/intake/normalize";
import { load_issued_grid } from "../../../../../packages/core/tests/fixtures/outline/index.ts";
import { LESSON_SNIPPET, csv_with_snippet, issued_csv_bytes, issued_xlsx_bytes, make_stack, type Stack } from "./testing/outline-harness.ts";

let s: Stack;
beforeAll(async () => {
  s = await make_stack();
}, 60_000);
afterAll(async () => {
  await s?.drop();
});

describe("NL-26 AC-2 versions_and_counts [invariant]", () => {
  it("versions_and_counts: CSV and XLSX of one unit are filed under G6.U4 with the normalizer's counts; a changed row gives changed_lessons 1", async () => {
    const c = normalize_outline(load_issued_grid(), load_standards_index(), 200).counts;
    const expected_counts = { lessons: c.lessons, flex_days: c.flex_days, arc_headers: c.arc_headers, total_rows: c.totals };

    const v1 = await s.service.upload(s.author, { filename: "issued.csv", content_type: "text/csv", data: issued_csv_bytes() }, null);
    expect(v1.unit_id).toBe("G6.U4");
    expect(v1.unit_key).toBe("g6-u4");
    expect(v1.version_number).toBe(1);
    expect(v1.row_counts).toEqual(expected_counts);
    expect(v1.same_as_version).toBeNull();
    expect(v1.changed_lessons).toBe(0);

    const v2 = await s.service.upload(
      s.author,
      { filename: "issued.xlsx", content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data: issued_xlsx_bytes() },
      null,
    );
    expect(v2.unit_id).toBe("G6.U4");
    expect(v2.unit_key).toBe("g6-u4");
    expect(v2.version_number).toBe(2);
    expect(v2.row_counts).toEqual(expected_counts);

    const kinds = await s.query("select number, source_kind from outline_version where unit_id = 'G6.U4' order by number");
    expect(kinds.map((r) => r.source_kind)).toEqual(["upload_csv", "upload_xlsx"]);

    const changed = csv_with_snippet("Students compare two retellings of the same story and note one difference");
    expect(new TextDecoder().decode(changed)).not.toContain(LESSON_SNIPPET);
    const v3 = await s.service.upload(s.author, { filename: "issued-edited.csv", content_type: "text/csv", data: changed }, null);
    expect(v3.version_number).toBe(3);
    expect(v3.changed_lessons).toBe(1);
    expect(v3.same_as_version).toBeNull();
  });

  it("versions_and_counts: the sheet's own unit wins over a conflicting unit argument", async () => {
    const v = await s.service.upload(s.author, { filename: "issued.csv", content_type: "text/csv", data: issued_csv_bytes() }, "G9.U9" as never);
    expect(v.unit_id).toBe("G6.U4");
    expect((await s.query("select 1 from outline_version where unit_id = 'G9.U9'")).length).toBe(0);
  });
});

describe("NL-26 AC-7 fetched_once [invariant]", () => {
  it("fetched_once: a successful import calls fetch_export exactly once and stores the version from the bytes", async () => {
    s.fetcher.calls = [];
    s.fetcher.serve(issued_xlsx_bytes(), "https://docs.google.com/spreadsheets/d/synthetic");
    const before = await s.count("outline_version");
    const v = await s.service.import_link(s.author, { sheet_url: "https://docs.google.com/spreadsheets/d/synthetic/edit" });
    expect(s.fetcher.calls).toHaveLength(1);
    expect(v.unit_id).toBe("G6.U4");
    expect(await s.count("outline_version")).toBe(before + 1);
    const row = (await s.query("select source_kind, sha256 from outline_version where id = $1", [v.outline_version_id]))[0];
    expect(row.source_kind).toBe("sheet_link");
    expect(row.sha256).toBe(v.sha256);
  });

  it("fetched_once: reading units and rows afterwards never touches the fetcher", async () => {
    s.fetcher.calls = [];
    await s.service.list_units(s.author);
    await s.repo.rows("G6.U4.ov1");
    expect(s.fetcher.calls).toHaveLength(0);
  });

  it("fetched_once: a fetch refusal stores nothing", async () => {
    const before = [await s.count("outline_version"), await s.count("outline_row"), await s.count("audit_event")];
    s.fetcher.next = async () => {
      const { DomainRefusal } = await import("@ls/core/errors");
      throw new DomainRefusal("SHEET_NOT_PUBLIC", "This sheet is private; share it publicly or upload the file.", {});
    };
    await expect(s.service.import_link(s.author, { sheet_url: "https://docs.google.com/spreadsheets/d/synthetic" })).rejects.toMatchObject({
      code: "SHEET_NOT_PUBLIC",
    });
    expect([await s.count("outline_version"), await s.count("outline_row"), await s.count("audit_event")]).toEqual(before);
  });
});
