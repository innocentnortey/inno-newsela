import { describe, expect, it } from "vitest";
import { CHECK_RULES } from "@ls/core/checks/registry";
import { generation_rules } from "./generation.ts";

describe("generation_rules", () => {
  const kinds = generation_rules(CHECK_RULES).map((r) => r.kind);
  it("code_not_allowed_is_actionable", () => {
    expect(kinds).toContain("code_not_allowed");
  });
  it("missing_slot_is_actionable_open_slot_is_not", () => {
    expect(kinds).toContain("section_missing");
    for (const k of ["quote_placeholder_open", "excerpt_slot_open", "cross_lesson_link"]) expect(kinds).not.toContain(k);
  });
});
