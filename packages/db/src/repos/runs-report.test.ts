import { describe, expect, it } from "vitest";
import { count_slot_nodes } from "./runs-report.ts";

describe("count_slot_nodes", () => {
  it("count_slot_nodes_counts_nested", () => {
    const sections = [{ name: "A", content: [
      { type: "quote_placeholder", attrs: {} },
      { type: "bullet_list", content: [{ type: "list_item", content: [{ type: "excerpt_slot", attrs: {} }, { type: "quote_placeholder", attrs: {} }] }] },
    ] }];
    expect(count_slot_nodes(sections)).toEqual({ quote_placeholder: 2, excerpt_slot: 1 });
  });
  it("count_slot_nodes_ignores_filled_quote", () => {
    expect(count_slot_nodes([{ type: "quote", attrs: { origin: "excerpt_slot" } }])).toEqual({ quote_placeholder: 0, excerpt_slot: 0 });
  });
  it("count_slot_nodes_null_and_empty", () => {
    expect(count_slot_nodes(null)).toEqual({ quote_placeholder: 0, excerpt_slot: 0 });
    expect(count_slot_nodes([])).toEqual({ quote_placeholder: 0, excerpt_slot: 0 });
    expect(count_slot_nodes("quote_placeholder")).toEqual({ quote_placeholder: 0, excerpt_slot: 0 });
  });
});
