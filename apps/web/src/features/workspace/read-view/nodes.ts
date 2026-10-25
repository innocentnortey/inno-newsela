// The node and mark names the read view can draw. tests/unit/features/workspace/nodes-parity.test.ts keeps this equal to the editor schema.
export const READ_VIEW_NODES = [
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
] as const;

export const READ_VIEW_MARKS = ["strong", "em", "teacher_talk", "sample_response"] as const;
