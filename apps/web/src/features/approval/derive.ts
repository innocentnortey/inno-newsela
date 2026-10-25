import type { components } from "@/lib/api-types";
import { ApiError } from "@/lib/api-client";
import { lessonKeyFromId, unitKeyFromId } from "@/lib/keys";
import { COPY } from "./copy";

export type Lesson = components["schemas"]["Lesson"];
export type Issue = components["schemas"]["Issue"];
export type ChecklistItem = components["schemas"]["ChecklistItem"];
export type Rating = "usable_as_drafted" | "usable_with_edits" | "rewritten";
export const RATINGS: readonly { value: Rating; label: string }[] = [
  { value: "usable_as_drafted", label: "Usable as drafted" },
  { value: "usable_with_edits", label: "Usable with edits" },
  { value: "rewritten", label: "Rewritten" },
];

/** Display of the pin only; the full hash is what gets sent. */
export function shortHash(h: string): string {
  return `${h.slice(0, 4)}…${h.slice(-4)}`;
}

export function lessonNumberLabel(lessonId: string): string {
  const key = lessonKeyFromId(lessonId);
  if (!key) return lessonId;
  return key.startsWith("F") ? `Flex ${key.slice(1)}` : key.slice(1);
}

export function unitLabel(unitId: string): string {
  const m = /U(\d+)$/.exec(unitId);
  return m ? `Unit ${m[1]}` : unitId;
}

export function lessonHref(lessonId: string): string {
  const parts = lessonId.split(".");
  const unitKey = unitKeyFromId(parts.slice(0, 2).join(".")) ?? "";
  return `/units/${unitKey}/lessons/${parts[2] ?? ""}/approve`;
}

export type ScreenMode = "decide" | "not_submitted" | "frozen";
export function screenMode(l: Lesson): ScreenMode {
  if (l.state === "approved" || l.state === "exported") return "frozen";
  if (l.state === "submitted" && l.snapshot !== null) return "decide";
  return "not_submitted";
}

export function stepperStep(state: Lesson["state"]): 1 | 2 | 3 | 4 | 5 {
  switch (state) {
    case "in_review":
    case "changes_requested":
    case "reopened":
      return 2;
    case "submitted":
      return 3;
    case "approved":
      return 4;
    case "exported":
      return 5;
    default:
      return 1;
  }
}

export function waitingOn(l: Lesson): { lessonId: string }[] {
  return l.dependencies.filter((d) => d.direction === "waits_on" && d.status !== "source_approved").map((d) => ({ lessonId: d.lesson_id }));
}
export function waitingOnThis(l: Lesson): { lessonId: string }[] {
  return l.dependencies
    .filter((d) => d.direction === "depended_on_by" && d.status === "waiting_for_source_approval")
    .map((d) => ({ lessonId: d.lesson_id }));
}

export interface Row {
  key: ChecklistItem["key"] | "other";
  title: string;
  state: "ok" | "blocking";
  stateWord: "Done" | "Blocking";
  evidence: string;
  jump: { href: string; label: string } | null;
  link: { href: string; label: string } | null;
}

const STANDARDS_KINDS = ["standard_not_taught", "standard_not_checked", "code_not_allowed", "standard_confirmation", "standard_add_suggestion"] as const;
const QUOTES_KINDS = [
  "quote_placeholder_open", "excerpt_slot_open", "quote_unmatched", "page_out_of_range", "proper_noun_unsourced",
  "quote_without_source", "quote_too_long", "rights_to_clear", "linked_text_changed",
] as const;
const SAFETY_KINDS = ["safety_flag_open", "safety_note_without_tip", "safety_text_in_student_block", "disclosure_prompt"] as const;

const KIND_TO_KEY: Record<Issue["kind"], Row["key"]> = {
  ...(Object.fromEntries(STANDARDS_KINDS.map((k) => [k, "standards"])) as Record<(typeof STANDARDS_KINDS)[number], Row["key"]>),
  ...(Object.fromEntries(QUOTES_KINDS.map((k) => [k, "quotes_and_rights"])) as Record<(typeof QUOTES_KINDS)[number], Row["key"]>),
  ...(Object.fromEntries(SAFETY_KINDS.map((k) => [k, "content_safety"])) as Record<(typeof SAFETY_KINDS)[number], Row["key"]>),
  eld_label_mismatch: "eld_support",
  suggestion_pending: "ai_spans",
  cross_lesson_link: "dependencies",
  minutes_out_of_range: "other",
  section_missing: "other",
  schema_invalid: "other",
  vocabulary_over_cap: "other",
  vocabulary_word_missing: "other",
  arc_repeat: "other",
  judge_no: "other",
};

function evidenceFor(item: ChecklistItem, lesson: Lesson): string {
  if (item.key === "standards") {
    const focus = lesson.front_matter.standards.filter((s) => s.role === "focus" && s.confirmation !== "removed");
    if (focus.length > 0) {
      const all = focus.every((s) => s.confirmation === "confirmed");
      return `${focus.map((s) => s.code).join(", ")} ${all ? "confirmed" : "not all confirmed"}`;
    }
  }
  if (item.key === "quotes_and_rights") {
    const cards = lesson.text_cards.filter((c) => c.kind === "excerpt" || c.kind === "off-platform-text");
    if (cards.length > 0) return cards.map((c) => `${c.title} · rights: ${c.rights_status ?? "not recorded"}`).join("; ");
  }
  if (item.evidence_refs.length > 0) return item.evidence_refs.join(", ");
  return item.status === "ok" ? "No issues found" : "Needs attention";
}

function jumpFor(item: ChecklistItem, lesson: Lesson): Row["jump"] {
  for (const ref of item.evidence_refs) {
    const s = lesson.sections.find((x) => x.address === ref);
    if (s) return { href: `#sec-${s.address}`, label: `Jump to ${s.name}` };
  }
  return null;
}

export function checklistRows(a: { lesson: Lesson; issues: Issue[] | null; blockedIssues: Issue[]; unitKey: string }): Row[] {
  const { lesson } = a;
  const blocking = [...(a.issues ?? []), ...a.blockedIssues].filter((i) => i.level === "blocking" && i.blocks.includes("approve"));
  const byKey = new Map<Row["key"], Issue[]>();
  for (const i of blocking) byKey.set(KIND_TO_KEY[i.kind], [...(byKey.get(KIND_TO_KEY[i.kind]) ?? []), i]);

  const rows: Row[] = lesson.checklist.map((item) => {
    const mine = byKey.get(item.key) ?? [];
    const isBlocking = item.status === "open" || mine.length > 0;
    return {
      key: item.key,
      title: item.label,
      state: isBlocking ? "blocking" : "ok",
      stateWord: isBlocking ? "Blocking" : "Done",
      evidence: mine.length > 0 ? mine.map((i) => i.message).join("; ") : evidenceFor(item, lesson),
      jump: jumpFor(item, lesson),
      link: null,
    };
  });

  const waits = waitingOn(lesson);
  if (waits.length > 0) {
    const depRows: Row[] = waits.map((w) => {
      const n = lessonNumberLabel(w.lessonId);
      return {
        key: "dependencies", title: COPY.dependencyItem(n), state: "blocking", stateWord: "Blocking",
        evidence: "Waiting for the source lesson to be approved", jump: null,
        link: { href: lessonHref(w.lessonId), label: `Open Lesson ${n}` },
      };
    });
    const at = rows.findIndex((r) => r.key === "dependencies");
    if (at >= 0) rows.splice(at, 1, ...depRows);
    else rows.push(...depRows);
  }

  const others = byKey.get("other") ?? [];
  if (others.length > 0) {
    rows.push({
      key: "other", title: "Other blocking issues", state: "blocking", stateWord: "Blocking",
      evidence: others.map((i) => i.message).join("; "), jump: null, link: null,
    });
  }
  return rows;
}

export type ApproveView =
  | { kind: "stale" } | { kind: "rating" } | { kind: "four_eyes" } | { kind: "network" } | { kind: "forbidden" }
  | { kind: "dependency"; lessonIds: string[] } | { kind: "blocked"; issues: Issue[]; message: string } | { kind: "other"; message: string };

export function viewFromError(e: unknown): ApproveView {
  if (!(e instanceof ApiError)) return { kind: "network" };
  switch (e.code) {
    case "STALE_PIN": return { kind: "stale" };
    case "RATING_REQUIRED": return { kind: "rating" };
    case "FOUR_EYES": return { kind: "four_eyes" };
    case "NETWORK": return { kind: "network" };
    case "ROLE_FORBIDDEN": return { kind: "forbidden" };
    case "DEPENDENCY_UNAPPROVED": {
      // Contract (interface.openapi.yaml, DEPENDENCY_UNAPPROVED): details = { lesson_id } naming the unapproved source lesson.
      // The server (gates.ts details_for, NL-115 join) names them as `source_lesson_ids`; `lesson_id` is the contract's older spelling.
      const many = e.details.source_lesson_ids;
      const one = e.details.lesson_id;
      if (Array.isArray(many)) return { kind: "dependency", lessonIds: many.filter((x): x is string => typeof x === "string") };
      return { kind: "dependency", lessonIds: typeof one === "string" ? [one] : [] };
    }
    case "BLOCKED": {
      const raw = e.details.issues;
      const issues = (Array.isArray(raw) ? raw : []) as Issue[];
      return { kind: "blocked", issues, message: issues[0]?.message ?? e.message };
    }
    default: return { kind: "other", message: e.message };
  }
}

export function approveDisabledReason(a: { lesson: Lesson; view: ApproveView | null }): string | null {
  if (a.view?.kind === "stale") return "Reload to continue";
  if (a.view?.kind === "four_eyes") return COPY.fourEyesReason;
  const first =
    a.view?.kind === "dependency" && a.view.lessonIds[0] ? { lessonId: a.view.lessonIds[0] } : waitingOn(a.lesson)[0];
  if (first) return COPY.dependencyReason(lessonNumberLabel(first.lessonId));
  return a.view?.kind === "dependency" ? "Another lesson must be approved first" : null;
}
