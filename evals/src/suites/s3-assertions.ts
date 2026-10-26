// NL-109 (S3 draft golden): the eight pure assertions over one observed run, each mapped to a DO-5 failure
// category (docs/design/eval-plan.md FC-2..FC-9), and the first-failing-step trajectory. No database, no model.
// Details name sections, roles, counts and addresses only: never draft text, prompt text or cell text.
import { CHECK_KINDS, type CheckKind } from "@ls/core/checks/types";

export type FcId = "FC-2" | "FC-3" | "FC-4" | "FC-5" | "FC-6" | "FC-7" | "FC-8" | "FC-9";
export const ASSERTION_NAMES = [
  "draft_stored", "required_blocks", "section_minutes", "placeholder_count",
  "no_quote_node", "origin_present", "taught_and_checked", "lesson_link_blocking",
] as const;
export type S3AssertionName = (typeof ASSERTION_NAMES)[number];
export const VALID_ORIGINS: readonly string[] = ["outline", "outline-fixed", "narrowed", "added"];

export interface S3Expected {
  pair: string;
  authority: string;
  lesson_type: string;
  lesson_id: string;
  minutes_total: { target: number; tolerance: number };
  /** `minutes` is the stored-lesson section minutes (Learning in Action = Part A + Part B). */
  sections: { name: string; minutes: number; required_roles: { part: string | null; roles: string[] }[] }[];
  placeholders: { exact: number; roles: string[] };
  no_quote_node: boolean;
  focus_codes: { code: string; origin_expected: string; parent: string | null; taught_in: string; checked_in: string }[];
  optional_added: string[];
  lesson_links: { from: string; to: string; blocks: string[]; slot: string }[];
}

export interface S3Call {
  purpose: string; attempt: number; status: string; stop_reason: string | null;
  served_model: string | null; requested_model: string;
  input_tokens: number | null; output_tokens: number | null; cost_usd: string | null;
}
export interface S3Observed {
  run_state: string; // lesson_job.status; "missing" when no job row exists
  lesson_stored: boolean;
  draft: { blocks: { role: string; section: string; part: string | null; standard_codes: string[]; code_origins: string[] }[] } | null;
  schema_valid_first_pass: boolean | null;
  repairs_used: number;
  truncation_retries: number;
  sections: { name: string; minutes: number }[];
  minutes_total: number | null;
  node_types: Record<string, number>;
  codes: { code: string; origin: string | null }[];
  cfu_tags: string[];
  teaching_parts: number;
  link: { present: boolean; blocks: string[] } | null;
  failure_reasons: { check: string; check_kind: string | null }[];
  brakes: string[];
  calls: S3Call[];
}
export interface AssertionResult { name: S3AssertionName; passed: boolean; fc: FcId | null; detail: string }

/** FailureReason["check"] (packages/schema/src/api/runs.ts) -> FC. `check_failed` is refined by CHECK_KIND_TO_FC. */
export const FAILURE_KIND_TO_FC: Record<string, FcId> = {
  schema_invalid: "FC-2", truncated: "FC-2", rate_limited: "FC-2", provider_error: "FC-2", timeout: "FC-2",
  compile_error: "FC-3", check_failed: "FC-3", cancelled: "FC-2", capped: "FC-2",
};
export const CHECK_KIND_TO_FC: Record<CheckKind, FcId> = {
  schema_invalid: "FC-2",
  minutes_out_of_range: "FC-3", section_missing: "FC-3", arc_repeat: "FC-3", suggestion_pending: "FC-3",
  code_not_allowed: "FC-4", standard_confirmation: "FC-4", standard_add_suggestion: "FC-4", eld_label_mismatch: "FC-4",
  standard_not_taught: "FC-5", standard_not_checked: "FC-5", judge_no: "FC-5",
  quote_unmatched: "FC-6", page_out_of_range: "FC-6", proper_noun_unsourced: "FC-6", quote_without_source: "FC-6",
  quote_too_long: "FC-6", rights_to_clear: "FC-6", vocabulary_over_cap: "FC-6", vocabulary_word_missing: "FC-6",
  quote_placeholder_open: "FC-7", excerpt_slot_open: "FC-7",
  safety_flag_open: "FC-8", safety_note_without_tip: "FC-8", safety_text_in_student_block: "FC-8", disclosure_prompt: "FC-8",
  cross_lesson_link: "FC-9", linked_text_changed: "FC-9",
};
export const ALL_CHECK_KINDS: readonly string[] = CHECK_KINDS;

export function fc_for_failure(reasons: S3Observed["failure_reasons"], brakes: string[]): { fc: FcId; detail: string } {
  const first = reasons[0];
  if (first === undefined) return brakes.includes("truncation_retry") ? { fc: "FC-2", detail: "truncation retry fired" } : { fc: "FC-2", detail: "no draft stored and no failure reason" };
  if (first.check === "check_failed") {
    const kind = first.check_kind ?? "";
    const fc = (CHECK_KIND_TO_FC as Record<string, FcId | undefined>)[kind];
    return fc === undefined ? { fc: "FC-3", detail: `check_failed: unmapped check kind ${kind || "none"}` } : { fc, detail: `check_failed: ${kind}` };
  }
  const fc = FAILURE_KIND_TO_FC[first.check];
  return fc === undefined ? { fc: "FC-3", detail: `unmapped failure kind ${first.check}` } : { fc, detail: first.check };
}

const ok = (name: S3AssertionName, detail = ""): AssertionResult => ({ name, passed: true, fc: null, detail });
const bad = (name: S3AssertionName, fc: FcId, detail: string): AssertionResult => ({ name, passed: false, fc, detail });

/** A code counts as checked when a Pulse Check names it, names its listed parent, or names a leaf below it. */
function checked(code: string, parent: string | null, o: S3Observed): boolean {
  return o.cfu_tags.some((t) => t === code || t === parent || t.startsWith(`${code}.`));
}

export function run_assertions(expected: S3Expected, o: S3Observed): AssertionResult[] {
  const out: AssertionResult[] = [];

  if (o.lesson_stored && o.draft !== null) out.push(ok("draft_stored"));
  else {
    const f = o.draft === null && o.failure_reasons.length === 0 && o.run_state === "missing"
      ? { fc: "FC-2" as FcId, detail: "no job row: the run never produced a lesson job" }
      : fc_for_failure(o.failure_reasons, o.brakes);
    out.push(bad("draft_stored", f.fc, `run_state=${o.run_state}; ${f.detail}`));
  }

  const blocks = o.draft?.blocks ?? [];
  const missing: string[] = [];
  for (const sec of expected.sections) {
    for (const req of sec.required_roles) {
      for (const role of req.roles) {
        const found = blocks.some((b) => b.section === sec.name && b.role === role && (req.part === null || b.part === req.part));
        if (!found) missing.push(`${sec.name}${req.part === null ? "" : ` ${req.part}`}:${role}`);
      }
    }
  }
  out.push(missing.length === 0 ? ok("required_blocks") : bad("required_blocks", "FC-3", `missing ${missing.length}: ${missing.join(", ")}`));

  const { target, tolerance } = expected.minutes_total;
  const minute_problems: string[] = [];
  for (const sec of expected.sections) {
    const got = o.sections.find((s) => s.name === sec.name);
    if (got === undefined) minute_problems.push(`${sec.name} absent`);
    else if (Math.abs(got.minutes - sec.minutes) > 5) minute_problems.push(`${sec.name} ${got.minutes} vs ${sec.minutes}`);
  }
  if (o.minutes_total === null || Math.abs(o.minutes_total - target) > tolerance) minute_problems.push(`total ${o.minutes_total ?? "none"} outside ${target} +/- ${tolerance}`);
  out.push(minute_problems.length === 0 ? ok("section_minutes", `total ${o.minutes_total}`) : bad("section_minutes", "FC-3", minute_problems.join("; ")));

  const placeholders = (o.node_types["excerpt_slot"] ?? 0) + (o.node_types["quote_placeholder"] ?? 0);
  out.push(placeholders === expected.placeholders.exact
    ? ok("placeholder_count", `${placeholders}`)
    : bad("placeholder_count", "FC-7", `${placeholders} placeholders, expected exactly ${expected.placeholders.exact}`));

  const quotes = o.node_types["quote"] ?? 0;
  out.push(!expected.no_quote_node || quotes === 0 ? ok("no_quote_node") : bad("no_quote_node", "FC-6", `${quotes} quote node(s) in the stored lesson`));

  const origin_problems: string[] = [];
  for (const c of o.codes) if (c.origin === null || !VALID_ORIGINS.includes(c.origin)) origin_problems.push(`${c.code} origin ${c.origin ?? "missing"}`);
  const notes: string[] = [];
  for (const f of expected.focus_codes) {
    const seen = o.codes.find((c) => c.code === f.code);
    if (seen === undefined) { if (f.origin_expected !== "outline") notes.push(`${f.code} not recorded, covered via ${f.parent ?? "itself"}`); continue; }
    if (f.origin_expected !== "outline" && seen.origin === "outline") origin_problems.push(`${f.code} origin outline, expected ${f.origin_expected}`);
  }
  for (const code of expected.optional_added) {
    const seen = o.codes.find((c) => c.code === code);
    if (seen !== undefined && seen.origin !== "added") origin_problems.push(`${code} origin ${seen.origin ?? "missing"}, expected added`);
  }
  out.push(origin_problems.length === 0 ? ok("origin_present", notes.join("; ")) : bad("origin_present", "FC-4", origin_problems.join("; ")));

  const align_problems: string[] = [];
  for (const f of expected.focus_codes) {
    if (o.teaching_parts === 0) align_problems.push(`${f.code} no teaching part`);
    if (!checked(f.code, f.parent, o)) align_problems.push(`${f.code} no Pulse Check`);
  }
  out.push(align_problems.length === 0 ? ok("taught_and_checked") : bad("taught_and_checked", "FC-5", align_problems.join("; ")));

  if (expected.lesson_links.length === 0) out.push(ok("lesson_link_blocking", "no link expected"));
  else {
    const want = expected.lesson_links[0] as S3Expected["lesson_links"][number];
    const have = o.link;
    const missing_blocks = want.blocks.filter((b) => !(have?.blocks ?? []).includes(b));
    out.push(have !== null && have.present && missing_blocks.length === 0
      ? ok("lesson_link_blocking", `${want.from} -> ${want.to}`)
      : bad("lesson_link_blocking", "FC-9", have === null || !have.present ? `no lesson_link ${want.from} -> ${want.to}` : `link does not block: ${missing_blocks.join(", ")}`));
  }
  return out;
}

export type StepName = "normalize" | "plan" | "draft" | "compile" | "checks" | "repair";
export interface Trajectory {
  first_failing_step: StepName | null;
  fc: FcId | null;
  steps: { step: StepName; ok: boolean }[];
  repair_recovered: boolean;
}

/** Walks the pipeline in order and names the first step that went wrong. A repaired run records "checks" with repair_recovered. */
export function derive_trajectory(o: S3Observed, results: AssertionResult[]): Trajectory {
  const plan_done = o.calls.some((c) => c.purpose === "unit_plan" && c.status === "completed");
  const draft_calls = o.calls.filter((c) => c.purpose === "lesson_draft");
  const first_draft = draft_calls[0];
  const reasons = o.failure_reasons.map((r) => r.check);
  const draft_ok = first_draft !== undefined && first_draft.status === "completed" && first_draft.stop_reason !== "max_tokens" && o.schema_valid_first_pass !== false
    && !reasons.some((r) => r === "schema_invalid" || r === "truncated");
  const compile_ok = !reasons.includes("compile_error");
  const failed_final = !o.lesson_stored;
  const steps: Trajectory["steps"] = [
    { step: "normalize", ok: o.run_state !== "missing" },
    { step: "plan", ok: plan_done },
    { step: "draft", ok: draft_ok },
    { step: "compile", ok: compile_ok },
    { step: "checks", ok: o.repairs_used === 0 && !failed_final },
    { step: "repair", ok: !(o.repairs_used >= 1 && failed_final) },
  ];
  const first = steps.find((s) => !s.ok);
  const failing = results.find((r) => !r.passed);
  // A recovered repair is information, not a failure: no FC unless an assertion failed.
  const fc: FcId | null = failing?.fc ?? null;
  return { first_failing_step: first?.step ?? null, fc, steps, repair_recovered: o.repairs_used >= 1 && !failed_final };
}
