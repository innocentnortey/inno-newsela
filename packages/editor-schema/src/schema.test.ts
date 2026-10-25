import { describe, expect, it } from "vitest";
import {
  EDITOR_SCHEMA,
  MARK_NAMES,
  NODE_NAMES,
  SCHEMA_VERSION,
} from "./schema.ts";

const NODES = [
  "doc",
  "paragraph",
  "heading",
  "bullet_list",
  "ordered_list",
  "list_item",
  "table",
  "table_row",
  "table_cell",
  "table_header",
  "routine_heading",
  "callout",
  "collapsible",
  "teacher_tip",
  "quote_placeholder",
  "excerpt_slot",
  "quote",
  "text",
  "hard_break",
];

describe("node_and_mark_lists", () => {
  it("has exactly the allow-listed nodes", () => {
    expect(Object.keys(EDITOR_SCHEMA.nodes).sort()).toEqual([...NODES].sort());
    expect([...NODE_NAMES].sort()).toEqual([...NODES].sort());
  });
  it("has exactly four role marks and no colour mark", () => {
    expect(Object.keys(EDITOR_SCHEMA.marks).sort()).toEqual([
      "em",
      "sample_response",
      "strong",
      "teacher_talk",
    ]);
    expect(MARK_NAMES).not.toContain("textColor");
  });
  it("is version 1", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
