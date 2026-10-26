// TEST-ONLY fake ports for the replay tests (not a test file itself): a one-lesson world for CheckContextLoader, optionally
// with a later outline upload (ov2) that changes the lesson's row and the stored intake choices, and optional open safety flags.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FakeClock } from "@ls/core/ports/clock";
import type { LessonId, OutlineVersionId, Sha256, UnitId } from "@ls/core/ports/common";
import type { IntakeChoiceRow, OutlineRowRecord, RowContext } from "@ls/core/ports/outlines";
import type { SafetyFlagRow } from "@ls/core/ports/safety-flags";
import type { StandardRow } from "@ls/core/ports/standards";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { NormalizedRow } from "@ls/schema/outline";
import type { RunPin } from "./replay-finals-pin.ts";

const FIX = fileURLToPath(new URL("../../packages/core/tests/fixtures/", import.meta.url));
const read = (n: string): unknown => JSON.parse(readFileSync(`${FIX}${n}.json`, "utf8"));

export const LESSON = "G6.U4.L4" as LessonId;
export const UNIT = "G6.U4" as UnitId;
export const OV1 = "G6.U4.ov1" as OutlineVersionId;
export const OV2 = "G6.U4.ov2" as OutlineVersionId;
export const ROW1 = NormalizedRow.parse(read("row-wp1"));
export const ROW2 = NormalizedRow.parse({ ...(read("row-wp1") as object), title: "A Later Upload Title", focus_codes: ["W.6.2"] });

/** The WP-1 draft with the Look Back block at the template's 5 minutes (as good_wp1_draft() in the worker fixtures). */
export function good_draft_json(): string {
  const d = LessonDraft.parse(read("draft-wp1"));
  return JSON.stringify({ ...d, blocks: d.blocks.map((b) => (b.section === "Look Back" && b.minutes !== null ? { ...b, minutes: 5 } : b)) });
}

const choice = (v: OutlineVersionId, finding_id: string, c: string): IntakeChoiceRow =>
  ({ outline_version_id: v, finding_id, choice: c, status: "confirmed", confirmed_by: null, at: "2026-10-26T00:00:00.000Z" }) as unknown as IntakeChoiceRow;

export const RUN_CHOICES = [choice(OV1, "f1", "A"), choice(OV1, "f2", "B")];

export interface WorldOpts {
  later_upload?: boolean;
  flags?: SafetyFlagRow[];
  /** The graph says no generated version is stored for the lesson (so an unpinned loader falls back to the unit's latest). */
  source_null?: boolean;
  /** Make the OutlineRepo hand back a different version than asked (to prove the identity assert fails closed). */
  loader_follows?: OutlineVersionId;
}

export function open_flag(n = 39): SafetyFlagRow {
  return { flag_id: `sf:${LESSON}:${n}`, lesson_id: LESSON, source_row: n, teacher_tip_address: null, status: "open", cleared_by: null, note: null, cleared_at: null };
}

export function build_world(o: WorldOpts = {}) {
  const row_context_args: unknown[] = [];
  const row_of = (v: OutlineVersionId): NormalizedRow => (v === OV2 ? ROW2 : ROW1);
  const stored_choices = (v: OutlineVersionId): IntakeChoiceRow[] => (v === OV2 ? [choice(OV2, "f1", "Z")] : [choice(OV1, "f1", "A")]);
  const rec = (v: OutlineVersionId): OutlineRowRecord => ({ outline_version_id: v, row: row_of(v), row_hash: (v === OV2 ? "2" : "1").repeat(64) as Sha256 });
  const outlines = {
    async list_units() {
      return [{ unit_id: UNIT, grade: 6, title: "t", latest_outline_version_id: o.later_upload ? OV2 : OV1 }];
    },
    async rows(v: OutlineVersionId) { return [rec(o.loader_follows ?? v)]; },
    async row_context(v: OutlineVersionId, _id: LessonId, choices: readonly IntakeChoiceRow[] | null): Promise<RowContext> {
      row_context_args.push(choices);
      const ver = o.loader_follows ?? v;
      return { outline_version_id: ver, row: row_of(ver), row_hash: rec(ver).row_hash, arc_header: "Arc", neighbours: [], unit_rules: [], links: [],
        choices: choices === null ? stored_choices(ver) : [...choices] };
    },
  };
  const all_codes = [...new Set([...ROW1.focus_codes, ...ROW2.focus_codes])];
  const std = (code: string): StandardRow => ({ code, set: "CA_CCSS_ELA_6", text: `Official text of ${code}`, parent_code: null, is_leaf: true, eld_strand: null });
  const standards = {
    async index() { return { leaves_of: (c: string) => [c], text_of: () => null, resolve: () => { throw new Error("x"); } }; },
    async texts(codes: readonly string[]) { return all_codes.filter((c) => codes.includes(c)).map(std); },
  };
  const graph = {
    async dependencies() {
      return [{ direction: "waits_on" as const, lesson_id: "G6.U4.L5" as LessonId, slot_id: "s", source_state: "approved" as const, slot_filled: true, source_approved_hash: null }];
    },
    async dependants() { return ["G6.U4.L3" as LessonId]; },
    async source_outline_version() { return o.source_null ? null : o.later_upload ? OV2 : OV1; },
  };
  const reader = { async latest() { return null; }, async latest_derived() { return null; } };
  const suggestions = { async pending_for() { return []; } };
  const flags = { async open_for(id: LessonId) { return id === LESSON ? (o.flags ?? []) : []; } };
  const alignment = { async for_lesson() { return []; }, async coverage_rows() { return []; } };
  const pin: RunPin = {
    run_id: "run_test", unit_id: UNIT, outline_version_id: OV1, choices: RUN_CHOICES, choices_hash: "h".repeat(64), choices_hash_basis: "parsed",
    prompt_version_id: "pv_test", prompt_locked_hash: null, created_at: "2026-10-26T00:00:00.000Z",
  };
  return {
    pin, row_context_args,
    ports: {
      outlines: outlines as never, standards: standards as never, graph: graph as never, reader: reader as never,
      suggestions: suggestions as never, flags: flags as never, alignment: alignment as never, clock: new FakeClock(new Date("2026-10-26T12:00:00.000Z")),
    },
  };
}
