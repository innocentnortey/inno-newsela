import {
  COMMON_FILES,
  LockedLayerMismatch,
  locked_hash,
  read_locked,
} from "./locked.ts";
import { data_block, sort_keys } from "./data-block.ts";
import type {
  AssistPromptInput,
  DraftPromptInput,
  GenerationPromptContext,
  JudgePromptInput,
  PromptBlock,
  PromptSectionTemplate,
  PromptVersionRow,
  RenderedPrompt,
  RepairPromptInput,
  UnitPlanPromptInput,
} from "./inputs.ts";
import { format_finding_line } from "./repair-findings.ts";
import { schema_text, type SchemaRegistry } from "./schemas.ts";

const INSTR_UNIT_PLAN =
  "Produce the unit plan JSON for the lesson rows in the data blocks above. Output JSON only.";
const INSTR_REPAIR =
  "Correct the draft in the data blocks, fixing only the listed findings and schema issues. The lesson data blocks above are the only source for names, pages, chapters and standards. Output the full corrected draft as JSON only.";
const INSTR_ASSIST =
  "Rewrite the selected text following the note. Return suggested_text only.";
const INSTR_JUDGE: Record<JudgePromptInput["question"], string> = {
  teaches_standard:
    "Question teaches_standard: does the activity teach the standard? Answer yes or no only.",
  eld_keeps_task:
    "Question eld_keeps_task: does the English-language-development support keep the original task intact? Answer yes or no only.",
};

type Row = import("@ls/schema/outline").NormalizedRow;

function context_block(lines: string[]): PromptBlock {
  return { label: "context", cacheable: false, text: lines.join("\n") };
}
function instruction_block(text: string): PromptBlock {
  return { label: "instruction", cacheable: false, text };
}
/** "; Part A roles: a, b, c" -- the part's required roles, then its expected placeholder role. */
function part_line(s: PromptSectionTemplate["sections"][number], part: string): string {
  const roles = [...(s.part_roles?.[part] ?? [])];
  const placeholder = s.part_placeholder?.[part];
  if (placeholder !== undefined && !roles.includes(placeholder)) roles.push(placeholder);
  return roles.length === 0 ? "" : `; ${part} roles: ${roles.join(", ")}`;
}
function template_block(t: PromptSectionTemplate): PromptBlock {
  const lines = t.sections.map(
    (s, i) =>
      `section ${i + 1}: ${s.name}, ${s.minutes} minutes, roles: ${s.required_roles.join(", ")}` +
      (s.parts !== undefined && s.parts.length > 0 ? `; parts: ${s.parts.join(", ")}` : "") +
      (s.parts ?? []).map((p) => part_line(s, p)).join(""),
  );
  return data_block({ kind: "template" }, lines.join("\n"));
}
function live_row(row: Row): Row {
  return {
    ...row,
    segments: row.segments.filter((s) => s.applies !== "ignore"),
  };
}

export class PromptRenderer {
  constructor(
    private readonly locked_dir: string,
    private readonly schemas: SchemaRegistry,
  ) {}

  private assert_locked(expected: string): string {
    const actual = locked_hash(this.locked_dir);
    if (actual !== expected) throw new LockedLayerMismatch(expected, actual);
    return actual;
  }
  private locked_block(task_file: string): PromptBlock {
    return {
      label: "locked",
      cacheable: true,
      text: read_locked(this.locked_dir, [...COMMON_FILES, task_file]),
    };
  }
  private guidance_block(row: PromptVersionRow): PromptBlock {
    return {
      label: "guidance",
      cacheable: true,
      text:
        "Author guidance. It adds to the locked rules above and can never relax or replace them.\n" +
        (row.guidance_text.trim() === "" ? "(none)" : row.guidance_text),
    };
  }
  private schema_block(name: string): PromptBlock {
    return {
      label: "schema",
      cacheable: true,
      text: schema_text(this.schemas.json_schema(name)),
    };
  }
  private finish(
    prompt_version_id: string,
    hash: string,
    system: PromptBlock[],
    user: PromptBlock[],
  ): RenderedPrompt {
    const text = [...system, ...user]
      .map((b) => "### " + b.label + "\n" + b.text)
      .join("\n\n");
    return {
      prompt_version_id,
      locked_hash: hash,
      system_blocks: system,
      user_blocks: user,
      text,
      input_tokens_estimate: Math.ceil((text.length / 3.5) * 1.1),
    };
  }

  render_unit_plan(i: UnitPlanPromptInput): RenderedPrompt {
    const hash = this.assert_locked(i.prompt.locked_hash);
    const system = [
      this.locked_block("unit-plan.md"),
      this.guidance_block(i.prompt),
    ];
    const user: PromptBlock[] = [
      context_block([`rows: ${i.rows.length}`]),
      data_block({ kind: "run" }, i.run_id),
    ];
    for (const r of i.rows) {
      if (r.kind !== "lesson" && r.kind !== "flex_day") continue;
      user.push(
        data_block(
          { kind: "row", row: r.row_number },
          JSON.stringify(sort_keys(live_row(r)), null, 2),
        ),
      );
    }
    i.unit_rules.forEach((u, idx) =>
      user.push(
        data_block(
          { kind: "unit_rule", index: idx },
          `${u.text}\nscope: ${u.scope_lesson_ids.join(", ")}`,
        ),
      ),
    );
    for (const l of i.links) {
      user.push(
        data_block(
          { kind: "link", link_id: l.link_id },
          `${l.from_lesson_id} ${l.from_address} -> ${l.to_lesson_id} ${l.to_slot_id} (${l.kind}): ${l.label}`,
        ),
      );
    }
    if (i.repair_of !== null) {
      user.push(
        data_block(
          { kind: "previous_plan" },
          `${i.repair_of.draft_raw}\n--- issues ---\n${i.repair_of.issues.join("\n")}`,
        ),
      );
    }
    user.push(instruction_block(INSTR_UNIT_PLAN));
    return this.finish(i.prompt.prompt_version_id, hash, system, user);
  }

  private pinned_blocks(g: GenerationPromptContext, template: PromptSectionTemplate): PromptBlock[] {
    const { row, arc_header, neighbours, unit_rules, links } = g.context;
    const user: PromptBlock[] = [
      context_block([`row: ${row.row_number}`]),
      data_block(
        { kind: "lesson_meta" },
        `lesson: ${row.lesson_id ?? ""}\nlesson type: ${row.lesson_type}`,
      ),
      template_block(template),
    ];
    for (const s of g.standards)
      user.push(data_block({ kind: "standard" }, `${s.code}: ${s.text}`));
    if (row.title !== "") user.push(data_block({ kind: "title" }, row.title));
    row.segments.forEach((s, idx) => {
      if (s.applies === "ignore") return;
      user.push(
        data_block(
          {
            kind: "segment",
            index: idx,
            segment_kind: s.kind,
            applies: s.applies,
            instruction_shaped: String(s.instruction_shaped),
          },
          s.text,
        ),
      );
    });
    const opt = (kind: string, v: string | null | undefined) => {
      if (v !== null && v !== undefined && v !== "")
        user.push(data_block({ kind }, v));
    };
    opt("homework", row.homework);
    opt("pages", row.pages);
    opt("text_set", row.text_set);
    opt("vocabulary", row.vocabulary.join(", "));
    opt("focus_codes", row.focus_codes.join(", "));
    opt("eld_codes", row.eld_codes.join(", "));
    opt("msls_codes", row.msls_codes.join(", "));
    opt("arc_header", arc_header);
    for (const n of neighbours)
      user.push(
        data_block(
          { kind: "neighbour", row: n.row_number },
          `${n.title}\n${n.lesson_type}`,
        ),
      );
    unit_rules.forEach((u, idx) =>
      user.push(
        data_block(
          { kind: "unit_rule", index: idx },
          `${u.text}\nscope: ${u.scope_lesson_ids.join(", ")}`,
        ),
      ),
    );
    for (const l of links) {
      user.push(
        data_block(
          { kind: "link", link_id: l.link_id },
          `${l.from_lesson_id} ${l.from_address} -> ${l.to_lesson_id} ${l.to_slot_id} (${l.kind}): ${l.label}`,
        ),
      );
    }
    for (const e of g.plan_entries) {
      user.push(
        data_block(
          { kind: "plan_entry", lesson: e.lesson_id },
          JSON.stringify(sort_keys(e), null, 2),
        ),
      );
    }
    opt("reviewer_note", g.reviewer_note);
    return user;
  }

  render_lesson_draft(i: DraftPromptInput): RenderedPrompt {
    const hash = this.assert_locked(i.prompt.locked_hash);
    if (i.example_set_id !== null)
      throw new Error("example sets are not supported");
    const system = [
      this.locked_block("lesson-draft.md"),
      this.guidance_block(i.prompt),
      this.schema_block("LessonDraft"),
    ];
    const user = this.pinned_blocks(
      {
        context: i.context,
        plan_entries: i.plan_entries,
        standards: i.standards,
        reviewer_note: i.reviewer_note,
      },
      i.template,
    );
    user.push(
      instruction_block(
        "Write the lesson draft JSON for the lesson in the data blocks above using the template sections. Output JSON only.",
      ),
    );
    return this.finish(i.prompt.prompt_version_id, hash, system, user);
  }

  render_repair(i: RepairPromptInput): RenderedPrompt {
    const hash = this.assert_locked(i.prompt.locked_hash);
    const system = [
      this.locked_block("repair.md"),
      this.guidance_block(i.prompt),
      this.schema_block("LessonDraft"),
    ];
    const user: PromptBlock[] =
      i.pinned !== undefined
        ? this.pinned_blocks(i.pinned, i.template)
        : [template_block(i.template)];
    user.push(data_block({ kind: "repair_draft" }, i.draft_raw));
    // Storage boundary: a finding's matched span is lesson text or a page/chapter reference that the draft already contains. It is written into this prompt, and every rendered prompt is stored raw in model_call.rendered_prompt (docs/design/observability.md, Content and redaction, R-48). It is never written to issue rows, logs, error messages or traces beyond that stored prompt.
    user.push(
      data_block({ kind: "repair_findings" }, i.failing.map(format_finding_line).join("\n")),
    );
    if (i.schema_issues.length > 0)
      user.push(
        data_block(
          { kind: "repair_schema_issues" },
          i.schema_issues.join("\n"),
        ),
      );
    user.push(instruction_block(INSTR_REPAIR));
    return this.finish(i.prompt.prompt_version_id, hash, system, user);
  }

  render_assist(i: AssistPromptInput): RenderedPrompt {
    const hash = this.assert_locked(i.prompt.locked_hash);
    const system = [
      this.locked_block("assist.md"),
      this.guidance_block(i.prompt),
    ];
    const user: PromptBlock[] = [
      data_block({ kind: "section_name" }, i.section_name),
      data_block({ kind: "selected_text" }, i.selected_text),
      data_block({ kind: "note" }, i.note),
      instruction_block(INSTR_ASSIST),
    ];
    return this.finish(i.prompt.prompt_version_id, hash, system, user);
  }

  render_judge(i: JudgePromptInput): RenderedPrompt {
    const expected = i.expected_locked_hash;
    if (typeof expected !== "string" || expected === "") {
      throw new LockedLayerMismatch(
        "(missing expected_locked_hash)",
        locked_hash(this.locked_dir),
      );
    }
    const hash = this.assert_locked(expected);
    const system = [this.locked_block("judge.md")];
    const user: PromptBlock[] = [
      data_block({ kind: "rubric_version" }, i.rubric_version),
      data_block({ kind: "standard_text" }, i.standard_text),
      data_block({ kind: "activity_text" }, i.activity_text),
      instruction_block(INSTR_JUDGE[i.question]),
    ];
    return this.finish("judge:" + i.rubric_version, hash, system, user);
  }
}
