// NL-84: S7 helpers. The WP-4 four checks run on a lesson built around the real normalized row 39.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { safety_note_id, tip_address } from "@ls/core/compile/addresses";
import { approve_gate, merge_resolutions } from "@ls/core/checks/gates";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { RULE_GROUPS, run_checks } from "@ls/core/checks/registry";
import { gate_state, p, reading_lesson, section } from "@ls/core/checks/test-helpers";
import { ctx_with, flag } from "@ls/core/checks/rules/safety/test-support";
import type { CheckContext, CheckKind, SafetyFlagRow } from "@ls/core/checks/types";
import type { JsonValue } from "@ls/core/ports/common";
import type { NormalizedRow } from "@ls/schema/outline";
import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import { load_issued_grid } from "../../../packages/core/tests/fixtures/outline/index.ts";
import { run_normalizer } from "./s1-support.ts";

const LESSON = "G6.U4.L31";
const NOTE_PREFIX = "Warn students about potentially triggering scene";

export interface Wp4World {
  row: NormalizedRow;
  note_text: string;
  proposed_rows: number[];
}

export function wp4_world(): Wp4World {
  const outline = run_normalizer(load_issued_grid());
  const row = outline.rows.find((r) => r.row_number === 39);
  if (row === undefined) throw new Error("issued row 39 missing");
  const seg = row.segments.find((s) => s.kind === "safety_note");
  return {
    row,
    note_text: seg?.text.replace(/^[•\s]+/, "") ?? "",
    proposed_rows: outline.findings.filter((f) => f.kind === "safety_note_proposed").map((f) => f.row_number ?? -1),
  };
}

function lesson_with(w: Wp4World, o: { tip: boolean; homework_text?: string }): StoredLesson {
  const base = reading_lesson({ lesson_id: LESSON });
  const tip_node: PMNode = { type: "teacher_tip", attrs: { safety_note_id: safety_note_id(LESSON, 1) }, content: [p(w.note_text)] };
  return {
    ...base,
    sections: base.sections.map((s) => {
      if (s.name === "Learning in Action" && o.tip) return section(s.name, LESSON, 30, [tip_node, ...(s.content.content ?? [])]);
      if (s.name === "Homework" && o.homework_text !== undefined) return section(s.name, LESSON, 0, [p(o.homework_text)]);
      return s;
    }),
  };
}

function open_flag(w: Wp4World, status: "open" | "cleared"): SafetyFlagRow {
  const la = reading_lesson({ lesson_id: LESSON }).sections.find((s) => s.name === "Learning in Action");
  return flag({
    flag_id: safety_note_id(LESSON, 1), lesson_id: LESSON, source_row: 39, status,
    teacher_tip_address: tip_address(la?.address ?? `${LESSON}.LearninginAction`, 1),
    note: w.note_text,
  });
}

function ctx(w: Wp4World, lesson: StoredLesson, flags: SafetyFlagRow[]): CheckContext {
  return ctx_with(lesson, { row: { ...w.row, lesson_id: LESSON }, safety_flags: flags });
}

const kinds = (c: CheckContext, kind: CheckKind): number => run_checks(c, RULE_GROUPS.safety, CHECK_POLICY).findings.filter((f) => f.kind === kind).length;

export function wp4_actual(case_id: string, w: Wp4World): Record<string, JsonValue> {
  switch (case_id) {
    case "s7-wp4-1-proposed": {
      const segs = w.row.segments.filter((s) => s.kind === "safety_note");
      return {
        proposed_at_row: w.proposed_rows.includes(39) ? 39 : null, safety_segments: segs.length,
        segment_applies: segs[0]?.applies ?? null, text_starts_with: w.note_text.startsWith(NOTE_PREFIX) ? NOTE_PREFIX : null,
      };
    }
    case "s7-wp4-2-routed-to-tip": {
      const with_tip = ctx(w, lesson_with(w, { tip: true }), []);
      const without = ctx(w, lesson_with(w, { tip: false }), []);
      const ctl = run_checks(without, RULE_GROUPS.safety, CHECK_POLICY).findings.filter((f) => f.kind === "safety_note_without_tip");
      return {
        findings_without_tip: kinds(with_tip, "safety_note_without_tip"),
        tip_carries_note_id: JSON.stringify(with_tip.lesson).includes(`"safety_note_id":"${safety_note_id(LESSON, 1)}"`),
        control_findings_without_tip: ctl.length, control_is_blocking: ctl.every((f) => f.level === "blocking") && ctl.length > 0,
      };
    }
    case "s7-wp4-3-absent-from-student-blocks": {
      const only_tip = ctx(w, lesson_with(w, { tip: true }), []);
      const leaked = ctx(w, lesson_with(w, { tip: true, homework_text: w.note_text }), []);
      return {
        student_block_findings: kinds(only_tip, "safety_text_in_student_block"),
        control_has_student_block_finding: kinds(leaked, "safety_text_in_student_block") >= 1,
      };
    }
    case "s7-wp4-4-approve-refused-until-cleared": {
      const lesson = lesson_with(w, { tip: true });
      const open = run_checks(ctx(w, lesson, [open_flag(w, "open")]), RULE_GROUPS.safety, CHECK_POLICY).findings;
      const flagged = open.filter((f) => f.kind === "safety_flag_open");
      const decide = (fs: typeof open, recorded: Parameters<typeof merge_resolutions>[1]) =>
        approve_gate(gate_state({ action: "approve", issues: merge_resolutions(fs, recorded) }));
      const d_open = decide(open, []);
      const d_res = decide(open, flagged.map((f) => ({ kind: f.kind, address: f.address, code: null })));
      const cleared = run_checks(ctx(w, lesson, [open_flag(w, "cleared")]), RULE_GROUPS.safety, CHECK_POLICY).findings;
      const d_clear = decide(cleared, []);
      return {
        open_flag_blocking: flagged.filter((f) => f.level === "blocking").length,
        approve_allowed_while_open: d_open.allowed, approve_refusals_include_blocked: d_open.refusals.includes("BLOCKED"),
        approve_allowed_with_recorded_resolution: d_res.allowed,
        cleared_flag_open_findings: cleared.filter((f) => f.kind === "safety_flag_open").length, approve_allowed_when_cleared: d_clear.allowed,
      };
    }
    default: throw new Error(`unknown WP-4 case: ${case_id}`);
  }
}

/** M-38: a cleared row carries who, why and when; an open row carries none of the three. */
export function clear_record_ok(rows: { status: string; cleared_by: string | null; note: string | null; cleared_at: string | null }[]): boolean {
  return rows.every((r) =>
    r.status === "cleared"
      ? r.cleared_by !== null && (r.note ?? "").trim() !== "" && r.cleared_at !== null
      : r.cleared_by === null && r.cleared_at === null,
  );
}

export function sha256_of_files(dir_abs: string, files: string[]): string {
  return createHash("sha256").update(files.map((f) => `${f}:${createHash("sha256").update(readFileSync(path.join(dir_abs, f))).digest("hex")}\n`).join("")).digest("hex");
}
