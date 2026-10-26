import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EDITOR_SCHEMA, SCHEMA_VERSION, assert_known_nodes } from "@ls/editor-schema/schema";
import { content_hash } from "@ls/schema/content-hash";
import type { UnitId } from "@ls/schema/ids";
import { StoredLesson as StoredLessonSchema } from "@ls/schema/lesson";
import type { PMNode } from "@ls/schema/lesson";
import { LessonDraft as LessonDraftSchema, type LessonDraft } from "@ls/schema/lesson-draft";
import { NormalizedRow as NormalizedRowSchema, type NormalizedRow } from "@ls/schema/outline";
import { assign_addresses, part_address } from "./addresses.ts";
import { CompileError, compile_draft, type CompileContext } from "./compile-draft.ts";
import { ALL_LABELS, routine_icon } from "./labels.ts";
import { template_for } from "./templates.ts";

const load = (n: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../tests/fixtures/${n}.json`, import.meta.url), "utf8"));
const draft = (n: string): LessonDraft => LessonDraftSchema.parse(load(`draft-${n}`));
const row = (n: string): NormalizedRow => NormalizedRowSchema.parse(load(`row-${n}`));
const ctx = (r: NormalizedRow, lesson_type: string, schema_version: number = SCHEMA_VERSION): CompileContext => ({
  row: r, template: template_for(lesson_type)!, unit_id: "G6.U4" as UnitId, schema_version,
});
const walk = (n: PMNode, f: (n: PMNode) => void): void => {
  f(n);
  for (const c of n.content ?? []) walk(c, f);
};
const find = (n: PMNode, type: string): PMNode[] => {
  const out: PMNode[] = [];
  walk(n, (x) => { if (x.type === type) out.push(x); });
  return out;
};
const texts = (n: PMNode): string[] => {
  const out: string[] = [];
  walk(n, (x) => { if (x.type === "text") out.push(x.text ?? ""); });
  return out;
};
const wp1 = () => compile_draft(draft("wp1"), ctx(row("wp1"), "Reading"));
const wp4 = () => compile_draft(draft("wp4"), ctx(row("wp4"), "Writing"));
const sec = (c: ReturnType<typeof wp1>, name: string) => c.lesson.sections.find((s) => s.name === name)!;

describe("wp1_reading", () => {
  it("compiles in template order with addresses and parts", () => {
    const c = wp1();
    expect(c.lesson.sections.map((s) => s.name)).toEqual(["Launch", "Literacy Lab", "Learning in Action", "Look Back", "Homework"]);
    const lia = sec(c, "Learning in Action");
    expect(lia.address).toBe("G6.U4.L4.LearningInAction");
    expect(c.lesson.sections.map((s) => s.address)[0]).toBe("G6.U4.L4.Launch");
    const heads = find(lia.content as PMNode, "heading").map((h) => texts(h).join(""));
    expect(heads).toEqual(["Part A", "Part B"]);
    expect(part_address(lia.address, "Part A")).toBe("G6.U4.L4.LearningInAction.PartA");
    for (const s of c.lesson.sections) expect(assert_known_nodes(s.content as never, SCHEMA_VERSION).ok).toBe(true);
    expect(c.placeholders).toBe(2);
    expect(StoredLessonSchema.safeParse(c.lesson).success).toBe(true);
  });
});

describe("minutes_not_corrected", () => {
  it("keeps drafted minutes", () => {
    const c = wp1();
    expect(sec(c, "Look Back").minutes).toBe(3);
    expect(c.lesson.front_matter.minutes_total).toBe(5 + 10 + 30 + 3);
  });
});

describe("wp3_flex_day", () => {
  it("compiles the flex template", () => {
    const c = compile_draft(draft("wp3"), ctx(row("wp3"), "Flex Day"));
    expect(c.lesson.sections.map((s) => s.name)).toEqual(["Launch", "Learning in Action", "Look Back"]);
    expect(c.lesson.sections.map((s) => s.minutes)).toEqual([5, 40, 5]);
    expect(c.lesson.type).toBe("Flex Day");
    expect(c.lesson.title).toBe("Flex Day: Meaning-Making Huddle");
    expect(c.placeholders).toBe(0);
  });
});

const SENSITIVE = /abuse|triggering|warn/i;
describe("wp4_teacher_tip", () => {
  it("keeps the tip teacher-only", () => {
    const c = wp4();
    const hw = sec(c, "Homework");
    const tips = find(hw.content as PMNode, "teacher_tip");
    expect(tips).toHaveLength(1);
    expect(tips[0]!.attrs?.safety_note_id).toBe("G6.U4.L31.sn1");
    expect(texts(tips[0]!).join(" ")).toMatch(/domestic abuse/);
    expect(c.safety_tips).toEqual(["G6.U4.L31.Homework.Tip1"]);
    for (const s of c.lesson.sections) {
      const outside: string[] = [];
      const go = (n: PMNode): void => {
        if (n.type === "teacher_tip") return;
        if (n.type === "text") outside.push(n.text ?? "");
        n.content?.forEach(go);
      };
      go(s.content as PMNode);
      for (const t of outside) expect(t).not.toMatch(SENSITIVE);
    }
  });
});

describe("tip_fallback", () => {
  it("adds the segment text when the draft has no tip", () => {
    const d = draft("wp4");
    d.blocks = d.blocks.filter((b) => b.role !== "teacher_tip");
    const r = row("wp4");
    const c = compile_draft(d, ctx(r, "Writing"));
    const tips = find(sec(c, "Homework").content as PMNode, "teacher_tip");
    expect(tips).toHaveLength(1);
    expect(texts(tips[0]!).join("")).toBe(r.segments[0]!.text);
    expect(tips[0]!.attrs?.safety_note_id).toBe("G6.U4.L31.sn1");
    expect(c.safety_tips).toEqual(["G6.U4.L31.Homework.Tip1"]);
  });
  it("uses the last section when the template has no Homework", () => {
    const d = draft("wp3");
    const r = { ...row("wp3"), segments: row("wp4").segments };
    const c = compile_draft(d, ctx(r, "Flex Day"));
    expect(find(sec(c, "Look Back").content as PMNode, "teacher_tip")).toHaveLength(1);
    expect(c.safety_tips).toEqual(["G6.U4.FLEX-1a.LookBack.Tip1"]);
  });
});

describe("compile_errors", () => {
  const fail = (d: LessonDraft, c: CompileContext): CompileError => {
    try {
      compile_draft(d, c);
    } catch (e) {
      expect(e).toBeInstanceOf(CompileError);
      return e as CompileError;
    }
    throw new Error("expected CompileError");
  };
  it("section not in template", () => {
    const d = draft("wp3");
    d.blocks.push({ ...draft("wp1").blocks.find((b) => b.role === "routine_heading")!, section: "Literacy Lab" });
    const e = fail(d, ctx(row("wp3"), "Flex Day"));
    expect(e.reason).toBe("section_not_in_template");
    expect(e.lesson_id).toBe("G6.U4.FLEX-1a");
    expect(e.address).toBe("G6.U4.FLEX-1a.LiteracyLab");
  });
  it("role not allowed", () => {
    const d = draft("wp1");
    const hw = d.blocks.find((b) => b.role === "homework")!;
    d.blocks.push({ ...hw, section: "Launch" });
    const e = fail(d, ctx(row("wp1"), "Reading"));
    expect(e.reason).toBe("role_not_allowed");
    expect(e.address).toBe("G6.U4.L4.Launch");
    const d2 = draft("wp1");
    d2.blocks.push({ ...d2.blocks.find((b) => b.role === "callout_say")!, section: "Look Back" });
    expect(fail(d2, ctx(row("wp1"), "Reading")).reason).toBe("role_not_allowed");
  });
  it("unknown schema version", () => {
    const e = fail(draft("wp1"), ctx(row("wp1"), "Reading", 2));
    expect(e.reason).toBe("unknown_node");
    expect(e.address).toMatch(/^G6\.U4\.L4\./);
  });
});

describe("eld_support_cfu_shapes", () => {
  it("groups callouts in order, builds the support table and the CFU", () => {
    const c = wp1();
    const ll = sec(c, "Literacy Lab").content as PMNode;
    const cols = find(ll, "collapsible");
    const eld = cols.find((x) => x.attrs?.label === "Integrated ELD Instructions")!;
    expect(eld.content!.map((x) => x.attrs?.variant)).toEqual(["purpose", "say", "watch"]);
    const sup = cols.find((x) => x.attrs?.label === "Additional Student Support")!;
    const first = find(sup, "table_row")[0]!;
    expect(first.content!.map((x) => x.type)).toEqual(["table_header", "table_header"]);
    expect(first.content!.map((x) => texts(x).join(""))).toEqual(["Situation", "Try this"]);
    const rh = find(ll, "routine_heading").map((x) => texts(x).join(""));
    expect(rh).toContain("Pulse Check (L.6.4.b)");
    const ol = find(ll, "ordered_list")[0]!;
    expect(ol.attrs?.type).toBe("A");
    expect(ol.content).toHaveLength(4);
    const t = texts(ll);
    expect(t.filter((x) => x.endsWith(". Correct:"))).toEqual(["A. Correct:"]);
    expect(t.filter((x) => x.endsWith(". Incorrect:"))).toHaveLength(3);
  });
  it("labels teacher talk and picks icons", () => {
    const d = draft("wp3");
    const c = compile_draft(d, ctx(row("wp3"), "Flex Day"));
    const p = find(sec(c, "Launch").content as PMNode, "paragraph")[0]!;
    expect(p.content![0]!.text).toBe("Ask:");
    expect(p.content![0]!.marks!.map((m) => m.type)).toEqual(["strong", "teacher_talk"]);
    expect(p.content![1]!.marks!.map((m) => m.type)).toEqual(["teacher_talk"]);
    expect(routine_icon("Quick Write")).toBe("writing");
    expect(routine_icon("Pulse Check")).toBe("cfu");
    expect(routine_icon("Turn and Talk")).toBe("academic_discussion");
    expect(routine_icon("Language Study")).toBe("notes_section");
    expect(routine_icon("Something else")).toBe("notes_section");
  });
});

describe("no_invented_text", () => {
  it("adds only labelled text", () => {
    const d = draft("wp1");
    const c = compile_draft(d, ctx(row("wp1"), "Reading"));
    const all = c.lesson.sections.flatMap((s) => find(s.content as PMNode, "quote_placeholder"));
    expect(all[0]!.attrs?.reason).toBe(d.blocks.find((b) => b.role === "text_evidence_needed")!.text);
    const slots = c.lesson.sections.flatMap((s) => find(s.content as PMNode, "excerpt_slot"));
    expect(slots[0]!.attrs?.rights).toBe("unset");
    const corpus = [
      d.title,
      ...d.blocks.flatMap((b) => (b.part === null ? [] : [`Part ${b.part.replace(/^part\s+/i, "")}`])),
      ...d.blocks.flatMap((b) => [b.text, ...(b.cfu ? [b.cfu.stem, ...b.cfu.options, ...b.cfu.rationales] : [])]),
    ].join("\n");
    const codes = d.blocks.flatMap((b) => (b.cfu ? [b.cfu.standard_code] : []));
    for (const s of c.lesson.sections) {
      for (const raw of texts(s.content as PMNode)) {
        const t = raw.replace(/^[A-Z]\. /, "").trim();
        const ok =
          corpus.includes(t) ||
          ALL_LABELS.includes(t) ||
          codes.some((code) => t === `Pulse Check (${code})`);
        expect(ok, `invented text: ${raw}`).toBe(true);
      }
    }
  });
});

describe("hash_and_determinism", () => {
  it("hash matches", () => {
    const c = wp1();
    expect(c.content_hash).toBe(content_hash(c.lesson));
  });
  it("is deterministic", () => {
    expect(wp1()).toEqual(wp1());
  });
  it("assign_addresses is idempotent", () => {
    const c = wp1();
    const again = assign_addresses(c.lesson, "G6.U4" as UnitId);
    expect(again).toEqual(c.lesson);
    expect(assign_addresses(again, "G6.U4" as UnitId)).toEqual(again);
  });
  it("content is normalised", () => {
    for (const s of wp1().lesson.sections) {
      expect(EDITOR_SCHEMA.nodeFromJSON(s.content).toJSON()).toEqual(s.content);
    }
  });
});

describe("part labels and code tags", () => {
  const relabel = (d: LessonDraft, map: Record<string, string>): LessonDraft => ({
    ...d,
    blocks: d.blocks.map((b) => (b.part !== null && map[b.part] !== undefined ? { ...b, part: map[b.part]! } : b)),
  });
  const block = (over: Partial<LessonDraft["blocks"][number]>): LessonDraft["blocks"][number] => ({
    role: "paragraph", section: "Learning in Action", part: "Part A", text: "x", standard_codes: [], code_origins: [],
    cfu: null, minutes: null, ...over,
  });

  it("part_remaps_reported", () => {
    const d = relabel(draft("wp1"), { "Part A": "Gather evidence", "Part B": "Plan and write" });
    const c = compile_draft(d, ctx(row("wp1"), "Reading"));
    const lia = sec(c, "Learning in Action");
    const heads = find(lia.content as PMNode, "heading").map((h) => texts(h).join(""));
    expect(heads).toEqual(["Part A", "Part B"]);
    const content = (lia.content as PMNode).content ?? [];
    const i = content.findIndex((n) => n.type === "heading");
    expect(texts(content[i + 1]!).join("")).toBe("Gather evidence");
    expect(part_address(lia.address, "Part B")).toBe("G6.U4.L4.LearningInAction.PartB");
    expect(c.part_remaps).toHaveLength(2);
  });

  it("canonical_labels_unchanged", () => {
    expect(wp1().part_remaps).toEqual([]);
  });

  it("codes_survive_as_tags", () => {
    const d = draft("wp1");
    const extra = [
      block({ role: "routine_heading", text: "Percy's Voice", standard_codes: ["RL.6.1"], code_origins: ["outline"] }),
      block({ role: "routine_heading", text: "Already (RL.6.1)", standard_codes: ["RL.6.1"], code_origins: ["outline"] }),
      block({ role: "routine_heading", text: "Plain title" }),
      block({ role: "quick_write", section: "Look Back", part: null, text: "Write.", standard_codes: ["RL.6.1"], code_origins: ["outline"] }),
    ];
    const c = compile_draft({ ...d, blocks: [...d.blocks, ...extra] }, ctx(row("wp1"), "Reading"));
    const heads = c.lesson.sections.flatMap((s) => find(s.content as PMNode, "routine_heading").map((h) => texts(h).join("")));
    expect(heads).toContain("Percy's Voice (RL.6.1)");
    expect(heads).toContain("Already (RL.6.1)");
    expect(heads).not.toContain("Already (RL.6.1) (RL.6.1)");
    expect(heads).toContain("Plain title");
    expect(heads).toContain("Quick Write (RL.6.1)");
    expect(heads.some((h) => /^Pulse Check \(.+\)$/.test(h))).toBe(true);
  });
});
