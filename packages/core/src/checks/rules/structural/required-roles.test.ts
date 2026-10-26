import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  eld_block,
  make_ctx,
  p,
  reading_lesson,
} from "../../test-helpers.ts";
import { section_missing_rule } from "./section_missing.ts";

describe("section_missing required roles", () => {
  it("flags a Literacy Lab missing the watch callout, naming role and section", () => {
    const l = reading_lesson();
    const lab = l.sections.find((s) => s.name === "Literacy Lab")!;
    // same Literacy Lab, with the ELD group missing its watch callout
    lab.content = {
      type: "doc",
      content: (lab.content.content ?? []).map((n) =>
        n.type === "collapsible" && n.attrs?.label === "Integrated ELD Instructions" ? eld_block(["watch"]) : n,
      ),
    };
    const f = section_missing_rule.run(make_ctx(l), DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("required role callout_watch");
    expect(f[0]?.message).toContain("Literacy Lab");
    expect(f[0]?.address).toBe(lab.address);
  });

  it("flags a Learning in Action with no cfu heading", () => {
    const l = reading_lesson();
    const lia = l.sections.find((s) => s.name === "Learning in Action")!;
    // same Learning in Action, minus the Pulse Check
    const kept = lia.content.content ?? [];
    const at = kept.findIndex((n) => n.type === "routine_heading" && n.attrs?.icon === "cfu");
    lia.content = { type: "doc", content: [...kept.slice(0, at), p("No check.")] };
    const f = section_missing_rule.run(make_ctx(l), DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("required role cfu_item");
    expect(f[0]?.address).toBe(lia.address);
  });

  it("missing_required_slot_names_the_section_address", () => {
    const l = reading_lesson();
    const c = make_ctx(l);
    const ctx = {
      ...c,
      row: { ...c.row, segments: [{ kind: "writer_task" as const, text: "Write.", instruction_shaped: true, applies: "apply" as const }] },
    };
    const f = section_missing_rule.run(ctx, DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]?.address).toBe(l.sections.find((s) => s.name === "Learning in Action")?.address);
    expect(f[0]?.message).toContain("excerpt slot");
  });
});
