// The same compiled lesson (one content hash) must give the same findings through the three entry shapes that
// reach the checker: generation, the background check and submission. Each makes its own CheckContextLoader.load.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compile_draft } from "@ls/core/compile/compile-draft";
import { template_for } from "@ls/core/compile/templates";
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CHECK_RULES, run_checks } from "@ls/core/checks/registry";
import type { CheckFinding } from "@ls/core/checks/types";
import { FakeClock } from "@ls/core/ports/clock";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { NormalizedRow } from "@ls/schema/outline";
import { generation_rules } from "./generation.ts";

const FIXTURES = fileURLToPath(new URL("../../../../packages/core/tests/fixtures/", import.meta.url));
const read = (n: string): unknown => JSON.parse(readFileSync(`${FIXTURES}${n}.json`, "utf8"));
const row = NormalizedRow.parse(read("row-wp1"));
const arc = NormalizedRow.parse({ ...(read("row-wp1") as object), row_number: 6, kind: "arc_header", lesson_id: null, number: null });
const LESSON_ID = row.lesson_id as string;
const V1 = "v1";
const rec = (r: NormalizedRow) => ({ outline_version_id: V1, row: r, row_hash: "r".repeat(64) });
const SUPPRESSED = ["quote_placeholder_open", "excerpt_slot_open", "cross_lesson_link", "code_not_allowed"];

function make_loader(): CheckContextLoader {
  const outlines = {
    async list_units() { return [{ unit_id: "G6.U4", grade: 6, title: "t", latest_outline_version_id: V1 }]; },
    async rows() { return [rec(arc), rec(row)]; },
    async row_context() {
      return { outline_version_id: V1, row, row_hash: "r".repeat(64), arc_header: "Arc one", neighbours: [], unit_rules: [], links: [], choices: [] };
    },
  };
  const standards = {
    async index() { return { leaves_of: (c: string) => [c], text_of: () => null, resolve: () => { throw new Error("x"); } }; },
    async texts() { return []; },
  };
  const graph = {
    async dependencies() { return []; },
    async dependants() { return []; },
    async source_outline_version() { return null; },
  };
  const reader = { async latest() { return null; }, async latest_derived() { return null; } };
  const suggestions = { async pending_for() { return []; } };
  const flags = { async open_for() { return []; } };
  const alignment = { async for_lesson() { return []; }, async coverage_rows() { return []; } };
  return new CheckContextLoader(
    outlines as never, standards as never, graph as never, reader as never,
    suggestions as never, flags as never, alignment as never, new FakeClock(new Date("2026-02-03T04:05:06.000Z")),
  );
}

const FORGED = {
  title: "The Lightning Thief", author: "Medusa", edition: null, chapter: "Chapter 999",
  pages: "p. 999", kind: "off-platform-text" as const, content_available: false,
};

function compile(mutate?: (d: LessonDraft) => void) {
  const draft = LessonDraft.parse(read("draft-wp1"));
  mutate?.(draft);
  return compile_draft(draft, { row, template: template_for(row.lesson_type)!, unit_id: "G6.U4" as never, schema_version: SCHEMA_VERSION });
}

const key = (f: CheckFinding): string => `${f.kind}|${f.level}|${f.address}|${f.message}|${f.matched ?? ""}`;

async function three_paths(compiled: ReturnType<typeof compile>, lesson = compiled.lesson) {
  const load = () => make_loader().load(LESSON_ID as never, lesson, compiled.content_hash);
  const [g, b, s] = [await load(), await load(), await load()];
  return {
    hashes: [g.content_hash, b.content_hash, s.content_hash],
    generation: run_checks(g, generation_rules(CHECK_RULES), CHECK_POLICY).findings.map(key).sort(),
    background: run_checks(b, CHECK_RULES, CHECK_POLICY).findings.map(key).sort(),
    submission: CHECK_RULES.flatMap((r) => r.run(s, CHECK_POLICY)).map(key).sort(),
  };
}

const plant = (d: LessonDraft): void => {
  d.blocks[16]!.cfu!.rationales[3] += " The story never mentions Medusa on p. 999.";
};

describe("check parity", () => {
  it("same_hash_same_findings", async () => {
    const c = compile();
    const r = await three_paths(c);
    expect(r.hashes).toEqual([c.content_hash, c.content_hash, c.content_hash]);
    expect(r.background).toEqual(r.submission);
    expect(r.generation).toEqual(r.background.filter((k) => !SUPPRESSED.includes(k.split("|")[0]!)));
  });
  it("generation_has_no_schema_invalid_and_background_agrees", async () => {
    const r = await three_paths(compile());
    expect(r.generation.filter((k) => k.startsWith("schema_invalid"))).toEqual([]);
    expect(r.background.filter((k) => k.startsWith("schema_invalid"))).toEqual([]);
  });
  it("rationale_bypass_removed", () => {
    const kinds = generation_rules(CHECK_RULES).map((r) => r.kind);
    expect(kinds).toEqual(CHECK_RULES.map((r) => r.kind).filter((k) => !SUPPRESSED.includes(k)));
    const orig = CHECK_RULES.find((r) => r.kind === "schema_invalid")!;
    expect(generation_rules(CHECK_RULES).find((r) => r.kind === "schema_invalid")).toBe(orig);
  });
  it("forged_card_same_in_all_paths", async () => {
    const r = await three_paths(compile((d) => { plant(d); d.text_cards.push({ ...FORGED }); }));
    for (const list of [r.generation, r.background, r.submission]) {
      expect(list.some((k) => k.startsWith("proper_noun_unsourced|") && k.endsWith("|Medusa"))).toBe(true);
      expect(list.some((k) => k.startsWith("page_out_of_range|") && k.endsWith("|p. 999"))).toBe(true);
    }
  });
  it("edited_card_after_generation_does_not_change_findings", async () => {
    const c = compile(plant);
    const plain = await three_paths(c);
    const edited = await three_paths(c, { ...c.lesson, text_cards: [{ ...FORGED }] });
    expect(edited.generation).toEqual(plain.generation);
    expect(edited.background).toEqual(plain.background);
    expect(edited.submission).toEqual(plain.submission);
  });
});
