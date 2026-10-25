// NL-09 AC-3/AC-4/AC-5 [negative]
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DraftRole, LessonDraft, zod_issue_paths } from "./lesson-draft.ts";

const block = (o: Record<string, unknown> = {}) => ({
  role: "paragraph", section: "launch", part: null, text: "t", standard_codes: [], code_origins: [], cfu: null, minutes: null, ...o,
});
const draft = (blocks: unknown[], extra: Record<string, unknown> = {}) => ({ lesson_id: "G6.U4.L4", title: "T", blocks, text_cards: [], ...extra });
const cfu = (o: Record<string, unknown> = {}) => ({ stem: "s", options: ["a", "b", "c", "d"], key_index: 1, rationales: ["1", "2", "3", "4"], standard_code: "RL.6.1", ...o });
const paths = (x: unknown): string[] => {
  const r = LessonDraft.safeParse(x);
  if (r.success) throw new Error("expected failure");
  return zod_issue_paths(r.error);
};

describe("no_quote_role", () => {
  it("has exactly the 15 roles", () => {
    expect([...DraftRole.options].sort()).toEqual(
      ["routine_heading", "teacher_talk", "sample_response", "callout_purpose", "callout_say", "callout_watch", "support_table", "cfu_item", "quick_write", "text_evidence_needed", "excerpt_slot", "teacher_tip", "homework", "paragraph", "list"].sort(),
    );
    expect(DraftRole.options).toHaveLength(15);
  });
  it("rejects a quote role with the block path", () => {
    expect(paths(draft([block({ role: "quote" })]))).toContain("blocks[0].role");
  });
  it("emitted schema has no quote string", () => {
    const f = readFileSync(new URL("../../../docs/contracts/schemas/lesson-draft.schema.json", import.meta.url), "utf8");
    expect(f).not.toContain('"quote"');
  });
});

describe("cfu_rules", () => {
  it("passes the control", () => {
    expect(LessonDraft.safeParse(draft([block({ role: "cfu_item", cfu: cfu() })])).success).toBe(true);
  });
  it("rejects cfu on a non-cfu block", () => {
    expect(paths(draft([block({ cfu: cfu() })]))).toContain("blocks[0].cfu");
  });
  it("rejects key_index outside options", () => {
    expect(paths(draft([block({ role: "cfu_item", cfu: cfu({ key_index: 4 }) })]))).toContain("blocks[0].cfu.key_index");
  });
  it("rejects rationale count mismatch", () => {
    expect(paths(draft([block({ role: "cfu_item", cfu: cfu({ rationales: ["1", "2", "3"] }) })]))).toContain("blocks[0].cfu.rationales");
  });
  it("rejects cfu_item without cfu and origin mismatch", () => {
    const p = paths(draft([block({ role: "cfu_item", standard_codes: ["RL.6.1"] })]));
    expect(p).toContain("blocks[0].cfu");
    expect(p).toContain("blocks[0].code_origins");
  });
});

describe("issue_paths_only", () => {
  it("never echoes offending values", () => {
    const planted = "PLANTED-QUOTE-7c1";
    const a = paths(draft([block({ role: planted })])).join("\n");
    const b = paths(draft([block()], { title: 123, extra: planted })).join("\n");
    const c = paths(draft([block({ text: { x: planted } })])).join("\n");
    for (const s of [a, b, c]) expect(s).not.toContain(planted);
    expect(b).toContain("title");
  });
  it("uses $ for a root issue", () => {
    const r = LessonDraft.safeParse("x");
    expect(r.success).toBe(false);
    if (!r.success) expect(zod_issue_paths(r.error)).toEqual(["$"]);
  });
});
