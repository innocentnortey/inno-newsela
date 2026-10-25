import { describe, expect, it } from "vitest";
import { NormalizedRow } from "@ls/schema/outline";
import row_wp1 from "../../tests/fixtures/row-wp1.json" with { type: "json" };
import { FakeClock } from "../ports/clock.ts";
import { InvariantViolation } from "../errors.ts";
import type { LessonId, OutlineVersionId, Sha256, UnitId } from "../ports/common.ts";
import type { OutlineRowRecord } from "../ports/outlines.ts";
import type { StandardRow } from "../ports/standards.ts";
import type { AlignmentLinkRow, CoverageCell } from "../ports/alignment.ts";
import type { SafetyFlagRow } from "../ports/safety-flags.ts";
import type { SuggestionRow } from "../ports/suggestions.ts";
import type { DerivedRow } from "../ports/lesson-docs.ts";
import { CheckContextLoader } from "./context-loader.ts";
import { run_checks, CHECK_RULES } from "./registry.ts";
import { CHECK_POLICY } from "./policy.ts";
import { reading_lesson } from "./test-helpers.ts";

const L4 = "G6.U4.L4" as LessonId;
const L5 = "G6.U4.L5" as LessonId;
const L3 = "G6.U4.L3" as LessonId;
const V1 = "v1" as OutlineVersionId;
const V2 = "v2" as OutlineVersionId;
const HASH = "h".repeat(64) as Sha256;

const row4 = NormalizedRow.parse(row_wp1);
const row5 = NormalizedRow.parse({ ...row_wp1, row_number: 9, lesson_id: L5, number: 5 });
const row3 = NormalizedRow.parse({ ...row_wp1, row_number: 7, lesson_id: L3, number: 3 });
const arc = NormalizedRow.parse({
  ...row_wp1, row_number: 6, kind: "arc_header", lesson_id: null, number: null,
});
const link = {
  link_id: "lk1", from_lesson_id: L4, from_address: "homework", to_lesson_id: L5,
  to_slot_id: "excerpt", kind: "excerpt_slot" as const, label: "Zanzibar Tales excerpt",
};

const rec = (v: OutlineVersionId, row: NormalizedRow): OutlineRowRecord => ({
  outline_version_id: v, row, row_hash: "r".repeat(64) as Sha256,
});
const std = (code: string): StandardRow => ({
  code, set: "CA_CCSS_ELA_6", text: `Synthetic text for ${code}`, parent_code: null,
  is_leaf: true, eld_strand: null,
});
const derived = (id: LessonId, seq = 3): DerivedRow =>
  ({ lesson_id: id, seq, store_id: `s${seq}`, lesson: reading_lesson({ lesson_id: id }),
    content_hash: "d".repeat(64), state_vector: "", schema_version: 1,
    stored_at: new Date(0), stored_by: null }) as unknown as DerivedRow;
const flag = (id: LessonId, n: number): SafetyFlagRow =>
  ({ flag_id: `f${n}`, lesson_id: id, source_row: n, teacher_tip_address: null,
    status: "open", cleared_by: null, note: null, cleared_at: null });
const align = (origin: AlignmentLinkRow["origin"]): AlignmentLinkRow => ({
  lesson_id: L4, content_hash: HASH, code: "RL.6.1", address: "a", role: "I",
  origin, asserted_by: "outline", confirmed_by: null,
});

type Opts = {
  versions?: Record<string, OutlineRowRecord[]>;
  source?: OutlineVersionId | null;
  latest?: OutlineVersionId | null;
  deps?: LessonId[];
  dependants?: LessonId[];
  stored?: Record<string, DerivedRow>;
  flags?: Record<string, SafetyFlagRow[]>;
  align?: AlignmentLinkRow[];
  coverage?: CoverageCell[];
  suggestions?: SuggestionRow[];
  standards?: StandardRow[];
};

function build(o: Opts = {}) {
  const calls: string[] = [];
  const versions = o.versions ?? { v1: [rec(V1, arc), rec(V1, row3), rec(V1, row4), rec(V1, row5)] };
  const stds = o.standards ?? ["RL.6.1", "RL.6.2", "L.6.4.b"].map(std);
  const clock = new FakeClock(new Date("2026-02-03T04:05:06.000Z"));
  let pending_now: Date | null = null;
  const outlines = {
    async list_units() {
      calls.push("list_units");
      return [{ unit_id: "G6.U4" as UnitId, grade: 6, title: "t",
        latest_outline_version_id: o.latest === undefined ? V1 : o.latest }];
    },
    async rows(v: OutlineVersionId) {
      calls.push(`rows:${v}`);
      return [...(versions[v] ?? [])].reverse(); // out of order on purpose
    },
    async row_context(v: OutlineVersionId, id: LessonId) {
      calls.push(`row_context:${v}`);
      const r = versions[v]!.find((x) => x.row.lesson_id === id)!.row;
      return { outline_version_id: v, row: r, row_hash: "r".repeat(64) as Sha256,
        arc_header: "Arc one", neighbours: [], unit_rules: [], links: [link], choices: [] };
    },
  };
  const standards = {
    async index() {
      calls.push("index");
      return { leaves_of: (c: string) => [c], text_of: () => null, resolve: () => { throw new Error("x"); } };
    },
    async texts(codes: readonly string[]) {
      calls.push(`texts:${codes.join(",")}`);
      return stds.filter((s) => codes.includes(s.code));
    },
  };
  const graph = {
    async dependencies() {
      calls.push("dependencies");
      return (o.deps ?? []).map((id) => ({ direction: "waits_on" as const, lesson_id: id,
        slot_id: "s", source_state: "approved" as const, slot_filled: true, source_approved_hash: null }));
    },
    async dependants() { calls.push("dependants"); return o.dependants ?? []; },
    async source_outline_version() {
      calls.push("source_outline_version");
      return o.source === undefined ? null : o.source;
    },
  };
  const reader = {
    async latest() { return null; },
    async latest_derived(id: LessonId) {
      calls.push(`latest_derived:${id}`);
      return o.stored?.[id] ?? null;
    },
  };
  const suggestions = {
    async pending_for(_id: LessonId, now: Date) {
      calls.push("pending_for");
      pending_now = now;
      return o.suggestions ?? [];
    },
  };
  const flags = {
    async open_for(id: LessonId) { calls.push(`open_for:${id}`); return o.flags?.[id] ?? []; },
  };
  const alignment = {
    async for_lesson() { calls.push("for_lesson"); return o.align ?? []; },
    async coverage_rows() { calls.push("coverage_rows"); return o.coverage ?? []; },
  };
  const loader = new CheckContextLoader(
    outlines as never, standards as never, graph as never, reader as never,
    suggestions as never, flags as never, alignment as never, clock);
  return { loader, calls, now: () => pending_now, clock };
}

const lesson = (codes: string[] = []) => {
  const l = reading_lesson({ lesson_id: L4 });
  l.front_matter.standards = codes.map((code) => ({
    code, role: "I", origin: "outline", official_text: "front-matter only text",
  })) as never;
  return l;
};

describe("CheckContextLoader", () => {
  it("wp1_lesson4_context", async () => {
    const { loader } = build();
    const l = lesson(["RL.6.1"]);
    const ctx = await loader.load(L4, l, HASH);
    expect(ctx.lesson_id).toBe(L4);
    expect(ctx.outline_version_id).toBe(V1);
    expect(ctx.row).toEqual(row4);
    expect(ctx.row.row_number).toBe(8);
    expect(ctx.arc_header).toBe("Arc one");
    expect(ctx.allowed_codes).toEqual(["RL.6.1", "RL.6.2", "L.6.4.b"]);
    expect(ctx.standards.map((s) => s.code)).toEqual(["RL.6.1", "RL.6.2", "L.6.4.b"]);
    expect(ctx.links).toEqual([link]);
    expect(ctx.text_cards).toBe(l.text_cards);
    expect(ctx.content_hash).toBe(HASH);
    expect(Object.keys(ctx).sort()).toEqual(
      ["lesson_id", "content_hash", "outline_version_id", "lesson", "row", "arc_header",
        "allowed_codes", "standards", "text_cards", "links", "linked_lessons",
        "pending_suggestions", "safety_flags", "confirmations", "previous_lesson_flags",
        "unit_coverage"].sort());
  });

  describe("linked_lessons_use_stored_rows", () => {
    it("uses the stored seq 3 row", async () => {
      const stored = derived(L5, 3);
      const { loader } = build({ deps: [L5], stored: { [L5]: stored } });
      const ctx = await loader.load(L4, lesson(), HASH);
      expect(ctx.linked_lessons).toEqual([stored]);
    });
    it("omits a lesson with no stored doc", async () => {
      const { loader } = build({ deps: [L5], stored: {} });
      expect((await loader.load(L4, lesson(), HASH)).linked_lessons).toEqual([]);
    });
    it("includes dependants after dependencies, deduped", async () => {
      const { loader } = build({
        deps: [L3, L5], dependants: [L5, L4],
        stored: { [L3]: derived(L3), [L5]: derived(L5) },
      });
      const ctx = await loader.load(L4, lesson(), HASH);
      expect(ctx.linked_lessons.map((d) => d.lesson_id)).toEqual([L3, L5]);
    });
  });

  describe("suggestions_flags_confirmations", () => {
    it("passes pending suggestions with the clock's now", async () => {
      const s = { suggestion_id: "s1", lesson_id: L4 } as unknown as SuggestionRow;
      const b = build({ suggestions: [s] });
      const ctx = await b.loader.load(L4, lesson(), HASH);
      expect(ctx.pending_suggestions).toEqual([s]);
      expect(b.now()?.toISOString()).toBe("2026-02-03T04:05:06.000Z");
    });
    it("returns open safety flags", async () => {
      const f = flag(L4, 1);
      const { loader } = build({ flags: { [L4]: [f] } });
      expect((await loader.load(L4, lesson(), HASH)).safety_flags).toEqual([f]);
    });
    it("keeps only narrowed and added confirmations", async () => {
      const { loader } = build({ align: [align("outline"), align("narrowed"), align("added")] });
      const ctx = await loader.load(L4, lesson(), HASH);
      expect(ctx.confirmations.map((c) => c.origin)).toEqual(["narrowed", "added"]);
    });
  });

  it("uses_passed_lesson_only", async () => {
    const b = build({ deps: [L5], dependants: [L4], stored: { [L5]: derived(L5) } });
    await b.loader.load(L4, lesson(), HASH);
    expect(b.calls).not.toContain(`latest_derived:${L4}`);
    expect(b.calls).toContain(`latest_derived:${L5}`);
  });

  it("three_callers_same_context", async () => {
    const b = build({
      deps: [L5], stored: { [L5]: derived(L5) }, flags: { [L3]: [flag(L3, 2)] },
      align: [align("added")],
    });
    const l = lesson(["RL.6.1"]);
    const [a, c, d] = [
      await b.loader.load(L4, l, HASH),
      await b.loader.load(L4, l, HASH),
      await b.loader.load(L4, l, HASH),
    ];
    expect(c).toEqual(a);
    expect(d).toEqual(a);
    const ra = run_checks(a, CHECK_RULES, CHECK_POLICY);
    expect(run_checks(c, CHECK_RULES, CHECK_POLICY)).toEqual(ra);
    expect(run_checks(d, CHECK_RULES, CHECK_POLICY)).toEqual(ra);
  });

  it("missing_row_is_a_fault", async () => {
    const b = build({ versions: { v1: [rec(V1, arc), rec(V1, row3)] } });
    const err = await b.loader.load(L4, lesson(), HASH).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvariantViolation);
    expect((err as InvariantViolation).invariant).toBe(`lesson_has_outline_row: ${L4}`);
    expect(JSON.stringify((err as InvariantViolation).details)).not.toContain("Warm up");
    expect(b.calls.some((c) => c.startsWith("row_context") || c === "index" ||
      c.startsWith("texts") || c.startsWith("open_for") || c === "for_lesson" ||
      c === "pending_for" || c === "coverage_rows")).toBe(false);
  });

  describe("standards_official_only", () => {
    it("uses the repo result verbatim, not front-matter text", async () => {
      const { loader } = build();
      const ctx = await loader.load(L4, lesson(["RL.6.1"]), HASH);
      expect(ctx.standards.find((s) => s.code === "RL.6.1")?.text).toBe("Synthetic text for RL.6.1");
      expect(JSON.stringify(ctx.standards)).not.toContain("front-matter only text");
    });
    it("a code with no official row gets no standards row", async () => {
      const { loader } = build();
      const ctx = await loader.load(L4, lesson(["ZZ.9.9"]), HASH);
      expect(ctx.standards.map((s) => s.code)).not.toContain("ZZ.9.9");
    });
  });

  describe("outline_version_resolution", () => {
    const two = {
      v1: [rec(V1, NormalizedRow.parse({ ...row_wp1, title: "Old title" }))],
      v2: [rec(V2, NormalizedRow.parse({ ...row_wp1, title: "New title" }))],
    };
    it("prefers the version the lesson was generated from", async () => {
      const { loader } = build({ versions: two, source: V1, latest: V2 });
      const ctx = await loader.load(L4, lesson(), HASH);
      expect(ctx.outline_version_id).toBe(V1);
      expect(ctx.row.title).toBe("Old title");
    });
    it("falls back to the unit's latest version", async () => {
      const { loader } = build({ versions: two, source: null, latest: V2 });
      const ctx = await loader.load(L4, lesson(), HASH);
      expect(ctx.outline_version_id).toBe(V2);
      expect(ctx.row.title).toBe("New title");
    });
  });

  describe("previous_lesson_flags_and_unit_coverage", () => {
    it("reads the previous lesson's flags, skipping arc headers", async () => {
      const f = flag(L3, 4);
      const { loader } = build({ flags: { [L3]: [f], [L4]: [flag(L4, 1)] } });
      expect((await loader.load(L4, lesson(), HASH)).previous_lesson_flags).toEqual([f]);
    });
    it("is empty for the first lesson of the unit", async () => {
      const b = build({
        versions: { v1: [rec(V1, arc), rec(V1, row4)] }, flags: { [L3]: [flag(L3, 4)] },
      });
      expect((await b.loader.load(L4, lesson(), HASH)).previous_lesson_flags).toEqual([]);
      expect(b.calls).not.toContain(`open_for:${L3}`);
    });
    it("returns the unit coverage rows", async () => {
      const cov = [{ code: "RL.6.1", lesson_id: L4, role: "I", confirmation: "person",
        source: "working" }] as CoverageCell[];
      const { loader } = build({ coverage: cov });
      expect((await loader.load(L4, lesson(), HASH)).unit_coverage).toEqual(cov);
    });
  });
});
