// S-28b (NL-126 F-4): the built-in demo script for MODEL_PROVIDER_MODE=stub. Without it the first unit_plan call throws
// "unscripted stub call" and a Compose demo never leaves Planning. Applied only to a StubModelClient; real mode is untouched.
// Mirrors apps/web/e2e/integration/con-6/fixtures/common.ts script_good; production code does not import from testing/ or test/.
import type { ModelPrice } from "@ls/core/ports/common";
import { PRICE_TABLE } from "@ls/llm/prices";
import type { PriceLookup } from "@ls/llm/recorder";
import { StubModelClient, wp1_repaired_draft_text, wp2_lesson_draft_text, type StubScriptItem } from "@ls/llm/stub";

type Req = { user_blocks: ReadonlyArray<{ text: string }> };
const all_text = (req: Req): string => req.user_blocks.map((b) => b.text).join("\n");

/** Lesson id of a lesson_draft request (same patterns as the e2e fixtures). */
export function demo_lesson_of(req: Req): string {
  const t = all_text(req);
  const m = /lesson: (\S+)\s+lesson type/.exec(t) ?? /"lesson_id":\s*"([^"]+)"/.exec(t);
  return m ? m[1]! : "";
}

/** One UnitPlanDraft entry per requested row. The lesson id comes from the row's own JSON, else from the row number (lesson k is row k+4). */
export function demo_plan_json(req: Req): string {
  const t = all_text(req);
  const entries = [...t.matchAll(/kind=row row=(\d+)>>>\n([\s\S]*?)\n<<<END_OUTLINE_DATA/g)].map((m, i) => {
    const row = Number(m[1]);
    let lesson_id = `G6.U4.L${row - 4}`;
    try {
      const j = JSON.parse(m[2]!) as { lesson_id?: string | null };
      if (typeof j.lesson_id === "string" && j.lesson_id !== "") lesson_id = j.lesson_id;
    } catch {
      // keep the row-number fallback
    }
    return {
      lesson_id,
      day: i + 1,
      purpose: "Demo plan purpose (stub mode)",
      routines: ["Demo routine"],
      hands_forward: "Demo hand-forward",
      performance_task_thread: "Demo thread",
    };
  });
  return JSON.stringify({ entries });
}

// Flex Day and Assessment templates hold only these roles per section; keep the WP-2 blocks that fit.
const FLEX_ROLES: Record<string, readonly string[]> = {
  Launch: ["routine_heading", "teacher_talk", "sample_response"],
  "Learning in Action": ["routine_heading", "teacher_talk", "teacher_tip", "cfu_item", "callout_purpose", "callout_say", "callout_watch"],
  "Look Back": ["quick_write"],
};
const FLEX_MINUTES: Record<string, number> = { Launch: 5, "Learning in Action": 40, "Look Back": 5 };
const is_flex = (id: string, req: Req): boolean => /FLEX|ASSESS/i.test(id) || /lesson type:\s*(Flex Day|Assessment)/i.test(all_text(req));

type DraftBlock = { role: string; section: string; minutes: number | null; text: string };
function flex_blocks(blocks: DraftBlock[]): DraftBlock[] {
  const kept = blocks.filter((b) => FLEX_ROLES[b.section]?.includes(b.role) === true);
  const seen = new Set<string>();
  const mapped = kept.map((b) => {
    const first = !seen.has(b.section);
    seen.add(b.section);
    // WP-2 text cites pages of its own reading; a flex day has none, so its prose is generic (page refs would fail the range check).
    return { ...b, text: b.text === "" ? "" : b.text.replace(/\b(pages?|chapters?|pp?\.)\s*[\d\-–, ]+/gi, "the reading"), minutes: first ? (FLEX_MINUTES[b.section] ?? null) : null };
  });
  const at = mapped.findIndex((b) => b.section === "Learning in Action" && b.role === "cfu_item");
  const tip = { role: "teacher_tip", section: "Learning in Action", part: null, text: "Let pairs rehearse aloud first.", standard_codes: [], code_origins: [], cfu: null, minutes: null };
  return [...mapped.slice(0, at), tip, ...mapped.slice(at)];
}

/** L4 gets the WP-1 draft, everything else the WP-2 draft relabelled (as the e2e script does); flex days keep only the blocks their template allows. */
function draft_for(id: string, req: Req): StubScriptItem {
  const draft = JSON.parse(id === "G6.U4.L4" ? wp1_repaired_draft_text() : wp2_lesson_draft_text()) as { blocks: DraftBlock[] };
  const out = is_flex(id, req) ? { ...draft, blocks: flex_blocks(draft.blocks) } : draft;
  return { kind: "text", text: JSON.stringify({ ...out, lesson_id: id }) };
}

export function script_demo_stub(stub: StubModelClient): void {
  stub.script("GENERATION", "unit_plan", (req) => ({ kind: "text", text: demo_plan_json(req) }));
  stub.script("GENERATION", "lesson_draft", (req) => draft_for(demo_lesson_of(req), req));
  stub.script("REPAIR", "lesson_draft", (req) => draft_for(demo_lesson_of(req), req));
}

/** Stub mode only: the stub answers as "stub-model", absent from the real table, and the recorder refuses an unpriced call. Priced like Sonnet. */
export function demo_stub_prices(): PriceLookup {
  const real: ModelPrice = PRICE_TABLE.price_for("claude-sonnet-5-5");
  const prices = [...PRICE_TABLE.prices, { ...real, model_id: "stub-model" }];
  return {
    prices,
    confirmed_on: PRICE_TABLE.confirmed_on,
    price_for: (id: string) => prices.find((p) => p.model_id === id) ?? PRICE_TABLE.price_for(id),
  } as PriceLookup;
}

export function is_demo_stub(d: { settings: { model: { model_provider_mode: string } }; model_client: unknown }): d is { settings: { model: { model_provider_mode: string } }; model_client: StubModelClient } {
  return d.settings.model.model_provider_mode === "stub" && d.model_client instanceof StubModelClient;
}
