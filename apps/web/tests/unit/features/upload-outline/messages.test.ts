import { describe, expect, it } from "vitest";
import { ApiError, type ApiErrorCode } from "@/lib/api-client";
import { reportHref, sameHashLine, successLine, toUploadError } from "@/features/upload-outline/messages";
import type { components } from "@/lib/api-types";

const err = (code: ApiErrorCode, details: Record<string, unknown> = {}) =>
  new ApiError({ status: 400, code, message: "server words", details });

export const firstUpload: components["schemas"]["OutlineVersion"] = {
  outline_version_id: "G6.U4.ov1",
  unit_id: "G6.U4",
  unit_key: "g6-u4",
  version_number: 1,
  sha256: "a100000000000000000000000000000000000000000000000000000000000001",
  same_as_version: null,
  changed_lessons: 0,
  row_counts: { lessons: 41, flex_days: 6, arc_headers: 7, total_rows: 1 },
  created_at: "2026-10-25T14:50:00Z",
  created_by: "Author (demo)",
} as components["schemas"]["OutlineVersion"];

describe("toUploadError", () => {
  it("SHEET_NOT_PUBLIC", () => {
    expect(toUploadError(err("SHEET_NOT_PUBLIC")).text).toBe("This sheet is private. Share it publicly or upload the file.");
  });
  it("UNSUPPORTED_FILE type and too_large", () => {
    expect(toUploadError(err("UNSUPPORTED_FILE", { reason: "type" })).text).toBe("This file type isn't supported. Upload a CSV or XLSX file.");
    expect(toUploadError(err("UNSUPPORTED_FILE", { reason: "too_large" })).text).toBe("This file is over 5 MB. Upload a smaller CSV or XLSX file.");
  });
  it("HEADER_NOT_FOUND", () => {
    expect(toUploadError(err("HEADER_NOT_FOUND", { columns_looked_for: ["Lesson #", "Focus"] })).text).toBe(
      "Couldn't find the header row. We looked for these columns: Lesson #, Focus.",
    );
    expect(toUploadError(err("HEADER_NOT_FOUND")).text).toBe("Couldn't find the header row.");
  });
  it("header_columns_capped_and_filtered", () => {
    const cols = [1, ...Array.from({ length: 25 }, (_, i) => `c${i}`), "x".repeat(80)];
    const t = toUploadError(err("HEADER_NOT_FOUND", { columns_looked_for: cols })).text;
    expect(t).toContain("c0, c1");
    expect(t).not.toContain("c20");
    const long = toUploadError(err("HEADER_NOT_FOUND", { columns_looked_for: ["x".repeat(80)] })).text;
    expect(long).toContain("x".repeat(60) + ".");
  });
  it("too_many_rows_both_numbers", () => {
    expect(toUploadError(err("TOO_MANY_ROWS", { max_rows: 200, rows: 214 })).text).toBe(
      "Too many rows for one unit: this sheet has 214 rows; the limit is 200.",
    );
    expect(toUploadError(err("TOO_MANY_ROWS", {})).text).toBe("Too many rows for one unit: the limit is 200.");
  });
  it("SHEET_UNREACHABLE retries", () => {
    const u = toUploadError(err("SHEET_UNREACHABLE"));
    expect(u.text).toBe("Couldn't reach Google Sheets. Try again, or upload the file.");
    expect(u.retry).toBe(true);
  });
  it("ROLE_FORBIDDEN, network and fallback", () => {
    expect(toUploadError(err("ROLE_FORBIDDEN")).text).toBe("Only authors can upload an outline.");
    expect(toUploadError(new Error("x")).text).toBe("Couldn't reach Lesson Studio. Try again.");
    expect(toUploadError(err("INTERNAL" as ApiErrorCode)).text).toBe("Couldn't upload this outline. Nothing was stored. Try again.");
  });
});

describe("lines", () => {
  it("success_line_first_upload", () => {
    expect(successLine(firstUpload)).toBe("Grade 6 · Unit 4 · version 1 · 41 lessons · 6 flex days · 7 arc headers · 1 total row");
  });
  it("same_hash_line", () => {
    const v = { ...firstUpload, version_number: 2, same_as_version: 1 };
    expect(sameHashLine(v)).toBe("Version 2 is the same as version 1; 0 lessons changed.");
    expect(sameHashLine({ ...v, changed_lessons: 1 })).toBe("Version 2 is the same as version 1; 1 lesson changed.");
    expect(reportHref(v)).toBe("/units/g6-u4/outlines/2");
  });
});
