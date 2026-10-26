import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LessonDraft } from "@ls/schema/lesson-draft";
import { merge_resolutions, submit_gate } from "../../gates.ts";
import { CHECK_POLICY } from "../../policy.ts";
import { gate_state } from "../../test-helpers.ts";
import { build_ctx } from "./fixtures/build.ts";
import { page_out_of_range_rule } from "./page_out_of_range.ts";
import { proper_noun_unsourced_rule } from "./proper_noun_unsourced.ts";
import { quote_unmatched_rule } from "./quote_unmatched.ts";
import { build_sources } from "./sources.ts";

const FORGED = {
  title: "The Lightning Thief",
  author: "Medusa",
  edition: null,
  chapter: "Chapter 999",
  pages: "p. 999",
  kind: "off-platform-text" as const,
  content_available: false,
};
const PLANT = " The story never mentions Medusa on p. 999.";
const plant = (d: LessonDraft): void => {
  d.blocks[16]!.cfu!.rationales[3] += PLANT;
};
const forge = (d: LessonDraft): void => {
  plant(d);
  d.text_cards.push({ ...FORGED });
};
const keys = (ctx: ReturnType<typeof build_ctx>) =>
  [...proper_noun_unsourced_rule.run(ctx, CHECK_POLICY), ...page_out_of_range_rule.run(ctx, CHECK_POLICY)].map(
    (f) => ({ kind: f.kind, level: f.level, address: f.address, matched: f.matched }),
  );

describe("source trust", () => {
  it("forged_card_cannot_clear_name_and_page", () => {
    const plain = keys(build_ctx("wp1", { mutate: plant }));
    expect(plain).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "proper_noun_unsourced", level: "blocking", matched: "Medusa" }),
        expect.objectContaining({ kind: "page_out_of_range", level: "blocking", matched: "p. 999" }),
      ]),
    );
    expect(keys(build_ctx("wp1", { mutate: forge }))).toEqual(plain);
  });
  it("forged_card_title_cannot_license_quote", () => {
    const text = " Read “holds the sky above the busy city” aloud.";
    const plain = build_ctx("wp1", { mutate: (d) => { d.blocks[1]!.text += text; } });
    const forged = build_ctx("wp1", {
      mutate: (d) => {
        d.blocks[1]!.text += text;
        d.text_cards.push({ ...FORGED, title: "Zeus holds the sky above the busy city" });
      },
    });
    const f_plain = quote_unmatched_rule.run(plain, CHECK_POLICY);
    expect(f_plain.length).toBeGreaterThan(0);
    for (const f of f_plain) expect(f.level).toBe("blocking");
    expect(quote_unmatched_rule.run(forged, CHECK_POLICY)).toEqual(f_plain);
  });
  it("source_entries_have_trusted_origins", () => {
    const ctx = build_ctx("wp1");
    const { entries, texts } = build_sources(ctx);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) expect(["outline_row", "arc_header", "standard"]).toContain(e.origin);
    const row_text = JSON.stringify(ctx.row);
    for (const c of ctx.text_cards) {
      for (const v of [c.title, c.author, c.edition, c.chapter, c.pages]) {
        if (v !== null && !row_text.includes(v)) expect(texts).not.toContain(v);
      }
    }
  });
  it("editing_cards_changes_nothing", () => {
    const a = build_ctx("wp1");
    const b = { ...a, text_cards: [{ ...FORGED }], lesson: { ...a.lesson, text_cards: [{ ...FORGED }] } };
    expect(build_sources(b)).toEqual(build_sources(a));
  });
  it("outline_supplied_metadata_still_grounds", () => {
    const base = build_ctx("wp1", {
      mutate: (d) => { d.blocks[16]!.cfu!.rationales[3] += " This is as Rick Riordan writes on p. 230."; },
    });
    const ctx = { ...base, row: { ...base.row, text_set: "Percy Jackson by Rick Riordan", pages: "224–233" } };
    const names = proper_noun_unsourced_rule.run(ctx, CHECK_POLICY).map((f) => f.matched);
    expect(names).not.toContain("Riordan");
    expect(page_out_of_range_rule.run(ctx, CHECK_POLICY).map((f) => f.matched)).not.toContain("p. 230");
    const bad = build_ctx("wp1", {
      mutate: (d) => { d.blocks[16]!.cfu!.rationales[3] += " This is as Rick Riordan writes on p. 234."; },
    });
    const ctx2 = { ...bad, row: { ...bad.row, text_set: "Percy Jackson by Rick Riordan", pages: "224–233" } };
    expect(page_out_of_range_rule.run(ctx2, CHECK_POLICY).map((f) => f.matched)).toContain("p. 234");
  });
  it("reviewer_resolution_clears_forged_card_findings", () => {
    const ctx = build_ctx("wp1", { mutate: forge });
    const findings = [
      ...proper_noun_unsourced_rule.run(ctx, CHECK_POLICY),
      ...page_out_of_range_rule.run(ctx, CHECK_POLICY),
    ];
    expect(findings.length).toBeGreaterThan(1);
    const open = merge_resolutions(findings, []);
    expect(open.every((i) => !i.resolved)).toBe(true);
    expect(submit_gate(gate_state({ issues: open })).refusals[0]).toBe("BLOCKED");
    const done = merge_resolutions(
      findings,
      findings.map((f) => ({ kind: f.kind, address: f.address, code: f.code })),
    );
    expect(done.every((i) => i.resolved)).toBe(true);
    expect(submit_gate(gate_state({ issues: done })).allowed).toBe(true);
  });
  it("no_grounding_rule_reads_text_cards", () => {
    const dir = fileURLToPath(new URL(".", import.meta.url));
    const files = readdirSync(dir, { withFileTypes: true }).filter(
      (e) => e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".test.ts"),
    );
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) expect(readFileSync(dir + f.name, "utf8")).not.toContain("text_cards");
  });
});
