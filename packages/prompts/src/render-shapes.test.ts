import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCKED_DIR, locked_hash } from "./locked.ts";
import { PromptRenderer } from "./render.ts";
import { SchemaRegistry } from "./schemas.ts";
import { REPO_ROOT, TEMPLATE, assist_input, draft_input, judge_input, repair_input, unit_plan_input, wp2_row } from "./testing/fixtures.ts";

const r = () => new PromptRenderer(LOCKED_DIR, new SchemaRegistry());
const labels = (bs: { label: string }[]) => bs.map((b) => b.label);

describe("draft_wp2", () => {
  it("AC-1: block order, schema byte-equal, template, no examples", () => {
    const p = r().render_lesson_draft(draft_input(wp2_row()));
    expect(labels(p.system_blocks)).toEqual(["locked", "guidance", "schema"]);
    const u = labels(p.user_blocks);
    expect(u[0]).toBe("context");
    expect(u.at(-1)).toBe("instruction");
    expect(u.slice(1, -1).every((l) => l === "data")).toBe(true);
    const committed = readFileSync(`${REPO_ROOT}docs/contracts/schemas/lesson-draft.schema.json`, "utf8");
    expect(p.system_blocks[2]!.text).toBe(committed);
    const ctx = p.user_blocks.find((b) => b.text.includes("kind=template"))!.text;
    let at = -1;
    for (const s of TEMPLATE.sections) {
      const idx = ctx.indexOf(`${s.name}, ${s.minutes} minutes`);
      expect(idx).toBeGreaterThan(at);
      at = idx;
    }
    expect([...labels(p.system_blocks), ...u]).not.toContain("examples");
  });
  it("example sets are refused", () => {
    const i = { ...draft_input(wp2_row()), example_set_id: "ex1" };
    expect(() => r().render_lesson_draft(i)).toThrow("example sets are not supported");
  });
});

describe("unit_plan_repair_assist_judge", () => {
  it("unit plan: no schema block, rows delimited", () => {
    const p = r().render_unit_plan(unit_plan_input(wp2_row()));
    expect(labels(p.system_blocks)).toEqual(["locked", "guidance"]);
    expect(p.user_blocks.filter((b) => b.label === "data")).toHaveLength(2);
    expect(p.user_blocks.some((b) => b.text.includes("kind=row row=9"))).toBe(true);
  });
  it("repair: schema block, findings, no outline row", () => {
    const p = r().render_repair(repair_input());
    expect(labels(p.system_blocks)).toEqual(["locked", "guidance", "schema"]);
    const d = p.user_blocks.filter((b) => b.label === "data").map((b) => b.text);
    expect(d.some((t) => t.includes("missing_role: no cfu_item @ sections/0"))).toBe(true);
    expect(d.some((t) => t.includes("kind=row"))).toBe(false);
  });
  it("assist: selected text and note are data", () => {
    const p = r().render_assist(assist_input("hello"));
    expect(labels(p.system_blocks)).toEqual(["locked", "guidance"]);
    expect(p.user_blocks.filter((b) => b.label === "data")).toHaveLength(3);
    expect(p.user_blocks[0]!.text).toContain("Practice");
  });
  it("judge: locked only, question in instruction", () => {
    const p = r().render_judge(judge_input(locked_hash(LOCKED_DIR)));
    expect(labels(p.system_blocks)).toEqual(["locked"]);
    expect(p.prompt_version_id).toBe("judge:rubric_test_1");
    expect(p.user_blocks.at(-1)!.text).toContain("teaches_standard");
  });
});

describe("deterministic_and_estimate", () => {
  it("same input gives identical output and the documented estimate", () => {
    const a = r().render_lesson_draft(draft_input(wp2_row()));
    const b = r().render_lesson_draft(draft_input(wp2_row()));
    expect(a).toEqual(b);
    expect(a.input_tokens_estimate).toBe(Math.ceil((a.text.length / 3.5) * 1.1));
    expect(a.text).toBe([...a.system_blocks, ...a.user_blocks].map((x) => "### " + x.label + "\n" + x.text).join("\n\n"));
  });
});
