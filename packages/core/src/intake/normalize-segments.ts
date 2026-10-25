// Cell text -> SegmentRecords, unit rules, vocabulary items and segment-level findings.
import type { SegmentRecord } from "@ls/schema/outline";
import type { RawFinding } from "./normalize-codes.ts";
import { is_instruction_shaped } from "./instruction-patterns.ts";
import { is_safety_note_line } from "./safety-patterns.ts";

export type SegmentColumn = "tdq" | "description" | "text_set" | "homework" | "performance" | "foundational" | "vocabulary";

export interface CellSegments {
  segments: SegmentRecord[];
  findings: RawFinding[];
  /** Unit-rule texts, "<scope header>: <rule>". Scope ids are resolved by the caller. */
  rule_texts: string[];
  /** Vocabulary items (vocabulary column only), as written, bullet removed. */
  vocabulary: string[];
}

const RULE_HEADER = /^\W*across\b[^:\n]{1,60}:\s*$/i;
const RULE_ONE_LINE = /^\W*across\b[^:\n]{1,60}:\s*\S/i;
const BULLET = /^\s*[•\-*◦·]/;
const WRITER_TASK = /\bwriters?\b[^.\n]{0,40}\b(must|should|select|slect|choose|write to)\b/i;
const NOTE_LINE = /^\W*(context clues are not|instead,? think|consider\b|replace\b|suggest|recommend|reviewer|editor|note:|todo|maybe)|\bwhich is a lot\b/i;
const VOCAB_ITEM = /^\W*([A-Za-z][A-Za-z' -]*?)\s*\((\d+(?:[–,-]\d+)*)\)\s*$/;
const PLAIN_WORD_LIST = /^[A-Za-z'’-]+(?:\s*,\s*[A-Za-z'’ -]+)+\.?$|^[A-Za-z'’-]+$/;
const SAFETY_COLUMNS: readonly SegmentColumn[] = ["homework", "description", "text_set"];

const is_blank = (s: string): boolean => /^[\s\u00a0]*$/.test(s);

function strip_bullet(line: string): string {
  return line.replace(/^[\s•\-*◦·]+/, "");
}

export function segment_cell(column: SegmentColumn, cell: string): CellSegments {
  const out: CellSegments = { segments: [], findings: [], rule_texts: [], vocabulary: [] };
  if (cell === "") return out;
  if (is_blank(cell)) {
    out.findings.push({ kind: "non_breaking_space", original_text: cell, proposed_fix: "", default_choice: null });
    return out;
  }
  const lines = cell.split("\n");
  let rule_header: string | null = null; // active "Across ...:" list
  let note_mode = false; // sticky for foundational once a reviewer note starts
  let note_colon = false; // a note line ending ':' makes following bullets notes

  for (const line of lines) {
    let kind: SegmentRecord["kind"] = "content";
    let applies: SegmentRecord["applies"] = "apply";
    let extra: RawFinding | null = null;
    const blank = is_blank(line);

    if (rule_header !== null && !blank && BULLET.test(line)) {
      kind = "unit_rule";
      out.rule_texts.push(`${rule_header}: ${strip_bullet(line)}`);
    } else if (!blank && RULE_HEADER.test(line)) {
      kind = "unit_rule";
      rule_header = line.trim().replace(/:\s*$/, "");
      note_colon = false;
    } else if (!blank && RULE_ONE_LINE.test(line)) {
      kind = "unit_rule";
      rule_header = null;
      out.rule_texts.push(strip_bullet(line).trim());
    } else {
      rule_header = null;
      if (!blank && SAFETY_COLUMNS.includes(column) && is_safety_note_line(line)) {
        kind = "safety_note";
        applies = "show_only";
        extra = { kind: "safety_note_proposed", original_text: line, proposed_fix: null, default_choice: "confirm_safety_note" };
      } else if (!blank && WRITER_TASK.test(line)) {
        kind = "writer_task";
        extra = { kind: "writer_task", original_text: line, proposed_fix: null, default_choice: "excerpt_slot" };
      } else if (column === "vocabulary") {
        const item = VOCAB_ITEM.exec(line.replace(/^[\s•\-*◦·]+/, ""));
        if (blank) kind = "content";
        else if (item) {
          kind = "content";
          out.vocabulary.push(strip_bullet(line).trim());
        } else if (PLAIN_WORD_LIST.test(line.trim())) {
          kind = "content";
          for (const w of line.split(",")) if (w.trim() !== "") out.vocabulary.push(w.trim().replace(/\.$/, ""));
        } else kind = "editor_note";
      } else if (column === "foundational" || column === "description" || column === "text_set") {
        const is_note = !blank && NOTE_LINE.test(line);
        const continued = note_colon && !blank && (BULLET.test(line) || /^\s/.test(line));
        if (blank) {
          if (note_mode && column === "foundational") kind = "editor_note";
          note_colon = false;
        } else if (is_note || continued || (note_mode && column === "foundational")) {
          kind = "editor_note";
          if (column === "foundational") note_mode = true;
          note_colon = /:\s*$/.test(line);
        } else note_colon = false;
      }
    }

    const instruction_shaped = !blank && is_instruction_shaped(line);
    out.segments.push({ kind, text: line, instruction_shaped, applies });
    if (extra) out.findings.push(extra);
    if (kind === "content" && instruction_shaped) {
      out.findings.push({ kind: "instruction_shaped", original_text: line, proposed_fix: null, default_choice: "keep_as_content" });
    }
  }

  const seen = new Map<string, number>();
  for (const line of lines) {
    const t = line.trim();
    if (t.length >= 40) seen.set(t, (seen.get(t) ?? 0) + 1);
  }
  for (const [t, n] of seen) {
    if (n >= 2) out.findings.push({ kind: "duplicate_text", original_text: t, proposed_fix: null, default_choice: "keep_both" });
  }
  return out;
}
