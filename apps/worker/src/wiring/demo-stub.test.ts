// S-28b: the built-in demo script for stub mode.
import { describe, expect, it } from "vitest";
import { UnitPlanDraft } from "@ls/schema/unit-plan";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { StubModelClient } from "@ls/llm/stub";
import type { StructuredCallRequest } from "@ls/core/ports/model-client";
import { load_worker_settings } from "@ls/config/settings";
import { create_logger } from "@ls/obs/logger";
import { build_worker_deps } from "../deps.ts";
import { demo_stub_prices, is_demo_stub, script_demo_stub } from "./demo-stub.ts";

const row = (n: number, lesson_id: string) => `<<<OUTLINE_DATA kind=row row=${n}>>>\n${JSON.stringify({ lesson_id })}\n<<<END_OUTLINE_DATA>>>`;
function req(schema: string, alias: StructuredCallRequest["alias"], texts: string[]): StructuredCallRequest {
  return {
    alias,
    system_blocks: [],
    user_blocks: texts.map((text) => ({ text, cacheable: false, label: "data" })),
    output_schema_name: schema,
    output_json_schema: {},
    output_mode: "prompt_embedded",
    max_output_tokens: 100,
    timeout_ms: 1000,
    effort: null,
    temperature: null,
  };
}
const scripted = () => {
  const s = new StubModelClient();
  script_demo_stub(s);
  return s;
};

describe("script_demo_stub", () => {
  it("stub mode scripts unit_plan for the requested rows", async () => {
    const r = await scripted().complete(req("UnitPlanDraft", "GENERATION", [row(8, "G6.U4.L4"), row(9, "G6.U4.L5"), row(25, "G6.U4.L21")]));
    const plan = UnitPlanDraft.parse(JSON.parse(r.raw_text));
    expect(plan.entries.map((e) => e.lesson_id)).toEqual(["G6.U4.L4", "G6.U4.L5", "G6.U4.L21"]);
    expect(plan.entries.map((e) => e.day)).toEqual([1, 2, 3]);
  });

  it("stub mode returns a schema-valid lesson draft relabelled to the requested lesson", async () => {
    const r = await scripted().complete(req("LessonDraft", "GENERATION", ["lesson: G6.U4.L21\nlesson type: Reading"]));
    const d = LessonDraft.parse(JSON.parse(r.raw_text));
    expect(d.lesson_id).toBe("G6.U4.L21");
  });

  it("repair alias returns a valid draft", async () => {
    const r = await scripted().complete(req("LessonDraft", "REPAIR", ['{"lesson_id": "G6.U4.L7"}']));
    expect(LessonDraft.parse(JSON.parse(r.raw_text)).lesson_id).toBe("G6.U4.L7");
  });

  it("prices stub-model like the real model and keeps real ids", () => {
    const p = demo_stub_prices();
    expect(p.price_for("stub-model").model_id).toBe("stub-model");
    expect(p.price_for("claude-sonnet-5-5").model_id).toBe("claude-sonnet-5-5");
  });

  it("real mode scripts nothing", async () => {
    const base = { DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };
    const real = load_worker_settings({ ...base, MODEL_PROVIDER_MODE: "real", ANTHROPIC_API_KEY: "k", OPENROUTER_API_KEY: "k" });
    const deps = build_worker_deps(real, create_logger({ service: "worker", build_id: "t", level: "info", write: () => undefined }));
    expect(deps.model_client).not.toBeInstanceOf(StubModelClient);
    expect(is_demo_stub(deps)).toBe(false);
    await (deps.db as unknown as { close(): Promise<void> }).close();
  });
});
