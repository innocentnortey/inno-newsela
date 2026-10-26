import type { PMNode, StoredLesson } from "@ls/schema/lesson";
import { ELD_LABEL } from "../../../compile/labels.ts";
import { is_placeholder_code } from "../../../compile/standard-identity.ts";
import { parse_tag } from "../../../compile/standard-tags.ts";
import { node_text, visit_with_parts, walk } from "../structural/doc-walk.ts";

export type EvidenceKind = "teach" | "assess";
export type EvidenceActivity = "routine" | "pulse_check" | "quick_write";

/** One code named by one tagged heading, with the activity it belongs to and whether the activity is really there. */
export type EvidenceItem = {
  code: string;
  kind: EvidenceKind;
  activity: EvidenceActivity;
  /** As visit_with_parts gives it: the section address or `${section.address}.PartA`. */
  address: string;
  /** Section.name */
  section: string;
  /** 1-based position of the heading among ALL routine headings of the section (not persisted). */
  ordinal: number;
  /** Every code the same heading names, placeholders dropped. */
  tag_codes: readonly string[];
  substantiated: boolean;
};

export const TEACHING_SECTIONS: readonly string[] = ["Launch", "Literacy Lab", "Learning in Action"];

const QUICK_WRITE_LABEL = /^quick write$/i;

/**
 * Teaching text: a paragraph outside teacher tips, tables and every collapsible except the ELD one, where only a Say
 * callout counts (PD-39: purpose, watch and the support table are not teaching).
 */
function has_teaching_text(nodes: readonly PMNode[]): boolean {
  let found = false;
  const go = (n: PMNode): void => {
    if (found) return;
    if (n.type === "teacher_tip" || n.type === "table") return;
    if (n.type === "collapsible") {
      if (n.attrs?.label !== ELD_LABEL) return;
      for (const k of n.content ?? []) if (k.type === "callout" && k.attrs?.variant === "say") walk(k, (x) => { if (x.type === "paragraph" && node_text(x).trim() !== "") found = true; });
      return;
    }
    if (n.type === "paragraph") {
      if (node_text(n).trim() !== "") found = true;
      return;
    }
    for (const k of n.content ?? []) go(k);
  };
  for (const n of nodes) go(n);
  return found;
}

/**
 * The one reader of standards evidence. The heading tag is the codec; the kind of evidence comes from structure (the
 * icon attribute, the fixed Quick Write label), never from a title. Evidence belongs to the tagged heading's own span:
 * the siblings after it up to the next routine or part heading.
 */
export function read_evidence(lesson: StoredLesson): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const section of lesson.sections) {
    if (section.name === "Homework") continue;
    let ordinal = 0;
    visit_with_parts(section, ({ node, address, siblings, index }) => {
      if (node.type !== "routine_heading") return;
      ordinal += 1;
      const t = node_text(node).trim();
      const loose = parse_tag(t, false);
      let kind: EvidenceKind;
      let activity: EvidenceActivity;
      let tokens: string[];
      if (node.attrs?.icon === "cfu") {
        if (loose === null) return;
        kind = "assess";
        activity = "pulse_check";
        tokens = loose.codes;
      } else if (loose !== null && QUICK_WRITE_LABEL.test(loose.label)) {
        kind = "assess";
        activity = "quick_write";
        tokens = loose.codes;
      } else {
        const strict = parse_tag(t, true);
        if (strict === null) return;
        kind = "teach";
        activity = "routine";
        tokens = strict.codes;
      }
      const codes = tokens.filter((c) => !is_placeholder_code(c, lesson.lesson_id));
      if (codes.length === 0) return;
      const span: PMNode[] = [];
      for (let i = index + 1; i < siblings.length; i += 1) {
        const s = siblings[i];
        if (s === undefined || s.type === "routine_heading" || s.type === "heading") break;
        span.push(s);
      }
      const first = span[0];
      const substantiated =
        kind === "teach"
          ? has_teaching_text(span)
          : activity === "pulse_check"
            ? span.some((n) => n.type === "ordered_list")
            : first !== undefined && first.type === "paragraph" && node_text(first).trim() !== "";
      for (const code of codes) {
        out.push({ code, kind, activity, address, section: section.name, ordinal, tag_codes: codes, substantiated });
      }
    });
  }
  return out;
}
