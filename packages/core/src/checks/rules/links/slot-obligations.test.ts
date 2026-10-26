import { describe, expect, it } from "vitest";
import type { PMNode } from "@ls/schema/lesson";
import { approve_gate, merge_resolutions, submit_gate } from "../../gates.ts";
import { DEFAULT_POLICY, gate_state, make_ctx, p, reading_lesson, section } from "../../test-helpers.ts";
import type { CheckContext } from "../../types.ts";
import { excerpt_slot_open_rule } from "../grounding/excerpt_slot_open.ts";
import { section_missing_rule } from "../structural/section_missing.ts";
import type { UnitId } from "@ls/schema/ids";
import { assign_addresses } from "../../../compile/addresses.ts";
import { obligation_address } from "./slot-obligations.ts";
import { count_excerpt_slots } from "./slots.ts";
import { link } from "./test-support.ts";

const writer_task = (applies: "apply" | "show_only" | "ignore") => ({
  kind: "writer_task" as const, text: "Select and write to an excerpt.", instruction_shaped: true, applies,
});

function ctx_for(over: { segments?: CheckContext["row"]["segments"]; slot?: PMNode["attrs"] | null; incoming?: boolean }): CheckContext {
  const base = reading_lesson();
  const lesson = {
    ...base,
    sections: base.sections.map((s) =>
      s.name === "Homework"
        ? section("Homework", base.lesson_id, 0, [
            p("Write."),
            ...(over.slot ? [{ type: "excerpt_slot", attrs: { slot_id: "s1", ...over.slot } } as PMNode] : []),
          ])
        : s,
    ),
  };
  const c = make_ctx(lesson);
  return {
    ...c,
    row: { ...c.row, segments: over.segments ?? [] },
    links: over.incoming ? [{ ...link, from_lesson_id: "G6.U4.L3", to_lesson_id: c.lesson_id }] : [],
  };
}
const missing = (c: CheckContext) =>
  section_missing_rule.run(c, DEFAULT_POLICY).filter((f) => f.message.includes("excerpt slot"));

describe("slot obligations", () => {
  it("writer_task_without_slot_is_blocking", () => {
    const f = missing(ctx_for({ segments: [writer_task("apply")] }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ kind: "section_missing", level: "blocking" });
    expect(f[0]?.message).toContain("outline writer task");
    expect(f[0]?.address).toBe("G6.U4.L4.LearninginAction");
  });

  it("ignored_or_show_only_writer_task_is_no_obligation", () => {
    expect(missing(ctx_for({ segments: [writer_task("ignore"), writer_task("show_only")] }))).toEqual([]);
  });

  it("incoming_homework_link_requires_a_slot", () => {
    const f = missing(ctx_for({ incoming: true }));
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain("homework link from G6.U4.L3");
  });

  it("open_slot_satisfies_the_obligation_but_still_blocks", () => {
    const c = ctx_for({ segments: [writer_task("apply")], slot: { rights: "unset", source_ref: null } });
    expect(missing(c)).toEqual([]);
    expect(excerpt_slot_open_rule.run(c, DEFAULT_POLICY)[0]).toMatchObject({ level: "blocking" });
  });

  it("filled_slot_clears_both", () => {
    const c = ctx_for({ segments: [writer_task("apply")], slot: { rights: "cleared", source_ref: "ref" } });
    expect(missing(c)).toEqual([]);
    expect(excerpt_slot_open_rule.run(c, DEFAULT_POLICY)).toEqual([]);
  });

  it("gates_block_open_and_missing", () => {
    const absent = missing(ctx_for({ segments: [writer_task("apply")] }));
    const open = excerpt_slot_open_rule.run(
      ctx_for({ segments: [writer_task("apply")], slot: { rights: "unset", source_ref: null } }),
      DEFAULT_POLICY,
    );
    for (const found of [absent, open]) {
      const state = gate_state({ issues: merge_resolutions(found, []) });
      expect(submit_gate(state).refusals).toContain("BLOCKED");
      expect(approve_gate(state).refusals).toContain("BLOCKED");
    }
    const filled = gate_state({ issues: [] });
    expect(submit_gate(filled).allowed).toBe(true);
    expect(approve_gate(filled).allowed).toBe(true);
  });

  it("count_excerpt_slots_counts_filled_quotes", () => {
    const sec = (...n: PMNode[]) => [{ content: { type: "doc", content: n } as PMNode }];
    const quote = { type: "quote", attrs: { slot_id: "a", origin: "excerpt_slot" } } as PMNode;
    const placeholder = { type: "quote_placeholder", attrs: { slot_id: "b" } } as PMNode;
    const plain_quote = { type: "quote", attrs: { slot_id: "c" } } as PMNode;
    expect(count_excerpt_slots(sec(quote, placeholder, plain_quote))).toBe(1);
  });

  it("absent_learning_in_action_locates_the_slot_finding_at_the_canonical_address", () => {
    const c = ctx_for({ segments: [writer_task("apply")] });
    const no_lia = { ...c, lesson: { ...c.lesson, sections: c.lesson.sections.filter((x) => x.name !== "Learning in Action") } };
    const f = missing(no_lia);
    expect(f).toHaveLength(1);
    expect(f[0]?.address).toBe("G6.U4.L4.LearningInAction");
    expect(f[0]?.address).toBe(assign_addresses(c.lesson, "G6.U4" as UnitId).sections.find((x) => x.name === "Learning in Action")?.address);
    const [issue] = merge_resolutions(f, [{ kind: "section_missing", address: "G6.U4.L4.LearningInAction", code: null }]);
    expect(issue?.resolved).toBe(true);
  });

  it("stored_learning_in_action_address_wins", () => {
    const c = ctx_for({ segments: [writer_task("apply")] });
    expect(obligation_address(c)).toBe("G6.U4.L4.LearninginAction");
  });
});

