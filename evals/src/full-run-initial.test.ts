import { normalize_outline } from "@ls/core/intake/normalize";
import { load_standards_index } from "@ls/core/intake/standards-index";
import type { UnitId } from "@ls/schema/ids";
import type { NormalizedRow } from "@ls/schema/outline";
import { describe, expect, it } from "vitest";
import { load_issued_grid } from "../../packages/core/tests/fixtures/outline/index.ts";
import { assess_initial_draft, parse_valid } from "./full-run-initial.ts";
import { stub_drafts } from "./suites/s3-run.ts";

const row = normalize_outline(load_issued_grid(), load_standards_index(), 200).rows.find((r) => r.row_number === 9) as NormalizedRow;
const ctx = { row, unit_id: "G6.U4" as UnitId, schema_version: 1 };
type Draft = { lesson_id: string; blocks: { role: string; section: string; cfu: unknown; text?: string }[] };
const valid = (): Draft => ({ ...(structuredClone(stub_drafts("wp-2", null).repair) as Draft), lesson_id: row.lesson_id as string });

describe("assess_initial_draft", () => {
  it("assess_no_output_for_null_and_empty", () => {
    expect(assess_initial_draft(null, ctx).stage).toBe("no_output");
    expect(assess_initial_draft("", ctx).stage).toBe("no_output");
  });
  it("assess_unparseable_json", () => {
    expect(assess_initial_draft("{", ctx)).toEqual({ stage: "unparseable", issue_paths: ["$"], compile_message: null });
  });
  it("assess_schema_invalid_reports_paths", () => {
    const d = valid();
    const i = d.blocks.findIndex((b) => b.role === "cfu_item");
    expect(i).toBeGreaterThanOrEqual(0);
    (d.blocks[i] as { cfu: unknown }).cfu = null;
    const a = assess_initial_draft(JSON.stringify(d), ctx);
    expect(a.stage).toBe("schema_invalid");
    expect(a.issue_paths.some((p) => p.startsWith(`blocks.${i}.cfu`))).toBe(true);
    expect(parse_valid(a.stage)).toBe(false);
  });
  it("assess_compile_error_section_not_in_template", () => {
    const d = valid();
    (d.blocks[0] as { section: string }).section = "Not A Section";
    const a = assess_initial_draft(JSON.stringify(d), ctx);
    expect(a.stage).toBe("compile_error");
    expect(a.compile_message).toContain("section_not_in_template");
    expect(parse_valid(a.stage)).toBe(true);
  });
  it("assess_compile_error_when_row_missing", () => {
    const a = assess_initial_draft(JSON.stringify(valid()), { ...ctx, row: null });
    expect(a).toMatchObject({ stage: "compile_error", compile_message: "COMPILE_ERROR: row_missing" });
  });
  it("assess_compiled_for_valid_draft", () => {
    expect(assess_initial_draft(JSON.stringify(valid()), ctx)).toEqual({ stage: "compiled", issue_paths: [], compile_message: null });
  });
  it("assess_never_returns_draft_text", () => {
    const d = valid();
    (d.blocks[0] as { section: string }).section = "Not A Section";
    const texts = d.blocks.map((b) => b.text).filter((t): t is string => typeof t === "string" && t.length > 12);
    expect(texts.length).toBeGreaterThan(0);
    const out = JSON.stringify(assess_initial_draft(JSON.stringify(d), ctx));
    for (const t of texts) expect(out).not.toContain(t);
  });
});
