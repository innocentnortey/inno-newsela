// NL-96: helpers shared by the scripted stand-in worker's script modules (patterns copied from apps/worker/test/support/world.ts,
// which is a vitest-side file and is not imported).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Decimal from "decimal.js";
import type { ModelPrice } from "@ls/core/ports/common";
import { compute_lesson_links } from "@ls/core/intake/lesson-links";
import { normalize_outline } from "@ls/core/intake/normalize";
import { load_standards_index } from "@ls/core/intake/standards-index";
import { PRICE_TABLE } from "@ls/llm/prices";
import type { StubModelClient, StubScriptItem } from "@ls/llm/stub";
import type { NormalizedRow } from "@ls/schema/outline";
import { load_issued_grid } from "../../../../../../packages/core/tests/fixtures/outline/index.ts";
import { valid_plan_json } from "../../../../../worker/src/generation/testing/unit-plan-fakes.ts";

const STUB_DRAFTS = resolve(__dirname, "../../../../../worker/test/fixtures/stub-drafts");
export const L4 = "G6.U4.L4";
export const L5 = "G6.U4.L5";

export function load_fixture(name: string): { first_draft?: unknown; draft: unknown } {
  const raw = JSON.parse(readFileSync(resolve(STUB_DRAFTS, name), "utf8")) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("_"))) as { first_draft?: unknown; draft: unknown };
}
export const text = (v: unknown): StubScriptItem => ({ kind: "text", text: JSON.stringify(v) });
export const wp1 = load_fixture("wp-1.json");
export const wp2 = load_fixture("wp-2.json");

export function lesson_of(req: { user_blocks: ReadonlyArray<{ text: string }> }): string {
  const all = req.user_blocks.map((b) => b.text).join("\n");
  const m = /lesson: (\S+)\s+lesson type/.exec(all) ?? /"lesson_id":\s*"([^"]+)"/.exec(all);
  return m ? m[1]! : "";
}

export function outline_rows(): NormalizedRow[] {
  const outline = normalize_outline(load_issued_grid(), load_standards_index(), 200);
  void compute_lesson_links;
  return outline.rows;
}

export function plan_for(rows: readonly NormalizedRow[], req: { user_blocks: ReadonlyArray<{ text: string }> }, mutate?: (json: string) => string): StubScriptItem {
  const all = req.user_blocks.map((b) => b.text).join("\n");
  const wanted = [...all.matchAll(/kind=row row=(\d+)/g)].map((m) => Number(m[1]));
  const json = valid_plan_json(rows, wanted);
  return { kind: "text", text: mutate ? mutate(json) : json };
}

export function stub_prices(out_per_mtok = "10.00", in_per_mtok = "2.00") {
  const make = (model_id: string): ModelPrice => ({
    model_id,
    input_per_mtok: new Decimal(in_per_mtok),
    output_per_mtok: new Decimal(out_per_mtok),
    cache_read_per_mtok: new Decimal("0.20"),
    cache_write_per_mtok: new Decimal("2.50"),
  });
  const prices = [make("stub-model"), make("claude-sonnet-5-5")];
  return { prices, confirmed_on: PRICE_TABLE.confirmed_on, price_for: (id: string) => prices.find((p) => p.model_id === id) ?? PRICE_TABLE.price_for(id) };
}

/** Good drafts: WP-1 (first draft then repaired draft) for L4, WP-2 for L5, the WP-2 draft re-labelled for anything else. */
export function good_draft(id: string): unknown {
  return id === L4 ? wp1.draft : id === L5 ? wp2.draft : { ...(wp2.draft as object), lesson_id: id };
}
export function script_good(stub: StubModelClient, rows: readonly NormalizedRow[], opts: { l4_repair?: boolean } = {}): void {
  stub.script("GENERATION", "unit_plan", (req) => plan_for(rows, req));
  stub.script("GENERATION", "lesson_draft", (req) => {
    const id = lesson_of(req);
    return text(id === L4 && opts.l4_repair !== false ? wp1.first_draft : good_draft(id));
  });
  stub.script("REPAIR", "lesson_draft", (req) => text(good_draft(lesson_of(req))));
}
