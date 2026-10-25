import { CompileError as CoreCompileError, InvariantViolation } from "@ls/core/errors";
import { CompileError, compile_draft } from "@ls/core/compile/compile-draft";
import { template_for } from "@ls/core/compile/templates";
import { run_checks } from "@ls/core/checks/registry";
import type { CheckPolicy, CheckRule } from "@ls/core/checks/types";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { content_hash } from "@ls/schema/content-hash";
import type { CheckContextLoaderPort } from "./collaborators.ts";
import { build_front_matter_standards } from "./front-matter-standards.ts";
import type { JobState } from "./job-state.ts";

export class CompileCheckNode {
  constructor(
    private readonly loader: CheckContextLoaderPort,
    private readonly rules: readonly CheckRule[],
    private readonly policy: CheckPolicy,
  ) {}

  async run(state: JobState): Promise<JobState> {
    const job = state.job;
    const ctx = state.context;
    const raw = ctx?.raw_output ?? null;
    if (ctx === null || raw === null) throw new InvariantViolation("compile_check_without_output", { job_id: job.job_id });
    const reset: JobState = { ...state, draft: null, schema_issues: [], compiled: null, compile_error: null, check_result: null };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...reset, schema_issues: ["$"] };
    }
    const result = LessonDraft.safeParse(parsed);
    if (!result.success) {
      // Issue paths only: never the message or the input text.
      return { ...reset, schema_issues: result.error.issues.map((i) => i.path.join(".") || "$") };
    }
    const draft = result.data;
    const row = ctx.row_context.row;
    const template = template_for(row.lesson_type);
    if (template === undefined || job.lesson_id === null) throw new InvariantViolation("template_missing", { lesson_type: row.lesson_type });

    let compiled;
    try {
      compiled = compile_draft(draft, { row, template, unit_id: job.unit_id, schema_version: job.schema_version });
    } catch (e) {
      if (e instanceof CompileError || e instanceof CoreCompileError) return { ...reset, draft, compile_error: e.message };
      if (e instanceof RangeError) return { ...reset, draft, compile_error: "COMPILE_ERROR: structure_invalid" };
      throw e;
    }
    // NL-18 carry-in: the compiler leaves front_matter.standards empty. The hash covers front matter, so recompute it.
    const lesson = {
      ...compiled.lesson,
      front_matter: { ...compiled.lesson.front_matter, standards: build_front_matter_standards(row, ctx.standards) },
    };
    compiled = { ...compiled, lesson, content_hash: content_hash(lesson) };

    const check_ctx = await this.loader.load(job.lesson_id, compiled.lesson, compiled.content_hash);
    const check_result = run_checks(check_ctx, this.rules, this.policy);
    return { ...reset, draft, compiled, check_result };
  }
}
