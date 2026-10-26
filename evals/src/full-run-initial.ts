// Astra slice B: classify one stored draft output the way the worker's compile-check node does, so a report can say
// what the ORIGINAL draft was (M-31: parses against LessonDraft AND compiles) without re-running any check.
// Returns stages, zod issue paths and compiler messages only; never draft text.
import { CompileError, compile_draft } from "@ls/core/compile/compile-draft";
import { template_for } from "@ls/core/compile/templates";
import { CompileError as CoreCompileError } from "@ls/core/errors";
import type { UnitId } from "@ls/schema/ids";
import { LessonDraft } from "@ls/schema/lesson-draft";
import type { NormalizedRow } from "@ls/schema/outline";

export type InitialDraftStage = "no_output" | "unparseable" | "schema_invalid" | "compile_error" | "compiled";
export interface InitialDraftAssessment {
  stage: InitialDraftStage;
  issue_paths: string[];
  compile_message: string | null;
}

const done = (stage: InitialDraftStage, issue_paths: string[] = [], compile_message: string | null = null): InitialDraftAssessment =>
  ({ stage, issue_paths, compile_message });

export function assess_initial_draft(
  raw_output: string | null,
  ctx: { row: NormalizedRow | null; unit_id: UnitId; schema_version: number },
): InitialDraftAssessment {
  if (raw_output === null || raw_output === "") return done("no_output");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw_output);
  } catch {
    return done("unparseable", ["$"]);
  }
  const result = LessonDraft.safeParse(parsed);
  if (!result.success) return done("schema_invalid", result.error.issues.map((i) => i.path.join(".") || "$"));
  if (ctx.row === null) return done("compile_error", [], "COMPILE_ERROR: row_missing");
  const template = template_for(ctx.row.lesson_type);
  if (template === undefined) return done("compile_error", [], "COMPILE_ERROR: template_missing");
  try {
    compile_draft(result.data, { row: ctx.row, template, unit_id: ctx.unit_id, schema_version: ctx.schema_version });
  } catch (e) {
    if (e instanceof CompileError || e instanceof CoreCompileError) return done("compile_error", [], e.message);
    if (e instanceof RangeError) return done("compile_error", [], "COMPILE_ERROR: structure_invalid");
    return done("compile_error", [], "COMPILE_ERROR: unexpected");
  }
  return done("compiled");
}

export const parse_valid = (s: InitialDraftStage): boolean => (s === "schema_invalid" ? false : s === "compile_error" || s === "compiled");
