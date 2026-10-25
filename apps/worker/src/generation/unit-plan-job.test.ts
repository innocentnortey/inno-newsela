import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { InvariantViolation, ProviderError, SpendRefused } from "@ls/core/errors";
import type { CapName } from "@ls/core/ports/common";
import { SchemaRegistry } from "@ls/prompts/schemas";
import type { LessonLinkRecord } from "@ls/schema/outline";
import { build_job, valid_plan_json } from "./testing/unit-plan-fakes.ts";
import { INJECTION, claimed_job, make_rows, teaching_rows } from "./testing/unit-plan-fixtures.ts";
import { validate_plan } from "./unit-plan-job.ts";

const rows47 = make_rows(47);
const good = valid_plan_json(rows47);

function entries_of(json: string): Array<Record<string, unknown>> {
  return (JSON.parse(json) as { entries: Array<Record<string, unknown>> }).entries;
}
const short46 = JSON.stringify({ entries: entries_of(good).slice(0, 46) });
const dup = JSON.stringify({ entries: [...entries_of(good).slice(0, 46), entries_of(good)[0]] });
const outside = JSON.stringify({ entries: entries_of(good).map((e, i) => (i === 46 ? { ...e, lesson_id: "G6.U4.L99" } : e)) });

describe("UnitPlanJob", () => {
  it("stores_47_entries", async () => {
    const b = build_job({ script: [good] });
    const out = await b.job.run(b.claimed);
    expect(out).toMatchObject({ stored: true, entries: 47, failure: null });
    expect(b.runs.state).toBe("running");
    expect(b.runs.plan_stored_at).not.toBeNull();
    expect(b.calls.rows).toHaveLength(1);
    const row = b.calls.rows[0]!;
    expect(row.purpose).toBe("unit_plan");
    expect(row.output_mode).toBe("schema_enforced");
    expect(row.rendered_prompt.length).toBeGreaterThan(0);
    expect(out.model_call_id).toBe(row.model_call_id);
    expect(b.runs.calls.at(-1)).toBe("store_unit_plan");
  });

  it("scoped_input_and_links", async () => {
    const rows = make_rows(47, [25]);
    const links: LessonLinkRecord[] = [
      { link_id: "lk1", from_lesson_id: "G6.U4.L4", from_address: "a", to_lesson_id: "G6.U4.L5", to_slot_id: "s", kind: "homework_text", label: "Synthetic" },
    ];
    const unit_rules = [{ text: "Synthetic unit rule", scope_lesson_ids: [] }];
    const scope = [8, 9, 25];
    const plan = JSON.parse(valid_plan_json(rows, scope)) as { entries: Array<{ hands_forward: string }> };
    plan.entries[0]!.hands_forward = "See G6.U4.L30 for the continuation (synthetic)";
    const b = build_job({ script: [JSON.stringify(plan)], rows, scope_row_numbers: scope, links, unit_rules });
    const out = await b.job.run(b.claimed);
    const input = b.renderer.inputs[0]!;
    expect(input.rows.map((r) => r.row_number)).toEqual([8, 9, 25]);
    expect(input.unit_rules).toEqual(unit_rules);
    expect(input.links).toEqual(links);
    expect(b.runs.calls).toEqual(["pinned_choices", "store_unit_plan"]);
    expect(out).toMatchObject({ stored: true, entries: 3 });
    expect(b.runs.stored?.plan.entries.map((e) => e.lesson_id)).toEqual(["G6.U4.L4", "G6.U4.L5", "G6.U4.FLEX-1"]);
  });

  describe("invalid_plan_one_repair_then_pause", () => {
    it.each([
      ["46 entries", short46],
      ["duplicate lesson_id", dup],
      ["out-of-scope id", outside],
      ["not json", "this is not json"],
    ])("%s", async (_name, bad) => {
      const b = build_job({ script: [bad, bad] });
      const out = await b.job.run(b.claimed);
      expect(b.paid.requests).toHaveLength(2);
      const second = b.paid.requests[1]!;
      expect(second.ctx.purpose).toBe("repair");
      expect(second.ctx.attempt).toBe(1);
      expect(second.req.alias).toBe("REPAIR");
      expect(b.renderer.inputs[1]!.repair_of?.draft_raw).toBe(bad);
      expect(b.renderer.inputs[1]!.repair_of?.issues.length).toBeGreaterThan(0);
      expect(b.runs.stored).toBeNull();
      expect(b.runs.calls).not.toContain("store_unit_plan");
      expect(b.runs.state).toBe("paused");
      expect(b.runs.paused_check).toBe("unit_plan");
      expect(out.failure?.check).toBe("schema_invalid");
      expect(out).toMatchObject({ stored: false, entries: 0, model_call_id: null });
    });
  });

  it("repair_succeeds", async () => {
    const b = build_job({ script: [short46, good] });
    const out = await b.job.run(b.claimed);
    expect(out).toMatchObject({ stored: true, entries: 47, failure: null });
    expect(out.model_call_id).toBe(b.calls.rows[1]!.model_call_id);
    expect(b.calls.rows[1]!.purpose).toBe("repair");
  });

  describe("refusals_and_provider_errors", () => {
    it.each<CapName>(["run_cap", "day_cap", "project_cap"])("spend refused by %s", async (cap) => {
      const b = build_job({ script: [new SpendRefused({ refused_by: cap, scope: null, amount_usd: new Decimal(1) })] });
      const out = await b.job.run(b.claimed);
      expect(b.calls.rows).toHaveLength(0);
      expect(b.runs.capped_by).toBe(cap);
      expect(b.runs.state).toBe("capped");
      expect(out.failure?.check).toBe("capped");
      expect(out.stored).toBe(false);
      expect(b.runs.stored).toBeNull();
    });
    it.each([
      ["rate_limited", "rate_limited"],
      ["timeout", "timeout"],
    ] as const)("provider error %s", async (kind, check) => {
      const b = build_job({ script: [new ProviderError({ kind })] });
      const out = await b.job.run(b.claimed);
      expect(b.runs.state).toBe("paused");
      expect(out.failure?.check).toBe(check);
      expect(out.stored).toBe(false);
      expect(b.runs.stored).toBeNull();
    });
  });

  describe("checkpoint_no_repay", () => {
    it("reuses a completed unit_plan call", async () => {
      const b = build_job({ script: [] });
      b.calls.insert({ job_id: b.claimed.job_id, purpose: "unit_plan", attempt: 1, rendered_prompt: "p", raw_output: good, output_mode: "schema_enforced" });
      const out = await b.job.run(b.claimed);
      expect(out.stored).toBe(true);
      expect(b.paid.requests).toHaveLength(0);
    });
    it("reuses a completed repair call after an invalid first plan", async () => {
      const b = build_job({ script: [] });
      b.calls.insert({ job_id: b.claimed.job_id, purpose: "unit_plan", attempt: 1, rendered_prompt: "p", raw_output: short46, output_mode: "schema_enforced" });
      b.calls.insert({ job_id: b.claimed.job_id, purpose: "repair", attempt: 1, rendered_prompt: "p", raw_output: good, output_mode: "schema_enforced" });
      const out = await b.job.run(b.claimed);
      expect(out.stored).toBe(true);
      expect(out.model_call_id).toBe(b.calls.rows[1]!.model_call_id);
      expect(b.paid.requests).toHaveLength(0);
    });
  });

  it("instruction_shaped_cell_stays_data", async () => {
    const rows = make_rows(47);
    const target = teaching_rows(rows)[2]!;
    target.segments = [{ kind: "content", text: INJECTION, instruction_shaped: true, applies: "apply" }];
    const b = build_job({ script: [valid_plan_json(rows)], rows });
    const out = await b.job.run(b.claimed);
    const rendered = b.renderer.outputs.at(-1)!;
    expect(rendered.text.split(INJECTION)).toHaveLength(2);
    const data_blocks = rendered.user_blocks.filter((x) => x.text.includes(INJECTION));
    expect(data_blocks).toHaveLength(1);
    expect(data_blocks[0]!.text.startsWith("<<<OUTLINE_DATA")).toBe(true);
    expect(data_blocks[0]!.text.endsWith("<<<END_OUTLINE_DATA>>>")).toBe(true);
    expect(rendered.system_blocks.every((x) => !x.text.includes(INJECTION))).toBe(true);
    expect(rendered.user_blocks.filter((x) => x.label === "instruction").every((x) => !x.text.includes(INJECTION))).toBe(true);
    const req = b.paid.requests[0]!.req;
    expect(req.output_json_schema).toEqual(new SchemaRegistry().json_schema("UnitPlanDraft"));
    expect(req.output_mode).toBe("schema_enforced");
    expect(out.entries).toBe(47);
    expect(b.runs.stored?.plan.entries).toHaveLength(47);
  });

  it("guards", async () => {
    const b = build_job({ script: [] });
    await expect(b.job.run(claimed_job({ kind: "lesson" }))).rejects.toBeInstanceOf(InvariantViolation);
  });

  it("validate_plan reports out-of-order days", () => {
    const p = JSON.parse(good) as { entries: Array<{ day: number; lesson_id: string }> };
    p.entries[1]!.day = 1;
    const r = validate_plan(JSON.stringify(p), p.entries.map((e) => e.lesson_id));
    expect(r.plan).toBeNull();
    expect(r.issues).toContain("entries.1.day: days must be strictly ascending");
  });
});
