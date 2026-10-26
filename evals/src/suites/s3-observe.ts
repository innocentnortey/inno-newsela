// NL-109 (S3): reads one finished run out of the world's database into an S3Observed. Reads ids, counts, node types and
// codes; the draft text stays in the (discarded) test database and never reaches the observed object.
import { merge_resolutions, approve_gate, submit_gate } from "@ls/core/checks/gates";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { cross_lesson_link_rule } from "@ls/core/checks/rules/links/cross_lesson_link";
import { cfu_tags, teaching_parts } from "@ls/core/checks/rules/alignment/standards-view";
import { gate_state, make_ctx } from "@ls/core/checks/test-helpers";
import type { LessonLinkRecord } from "@ls/core/checks/types";
import type { UnitId } from "@ls/schema/ids";
import { LessonDraft } from "@ls/schema/lesson-draft";
import type { StoredLesson } from "@ls/schema/lesson";
import { assess_initial_draft } from "../full-run-initial.ts";
import type { S3Call, S3Observed } from "./s3-assertions.ts";
import type { World } from "./s6-world.ts";

type JobRow = { status: string; repairs: number; truncation_retries: number; failure_reasons_json: { check: string; check_kind?: string | null }[]; brakes_fired: string[] };
type CallRow = S3Call & { raw_output: string | null };

function count_nodes(node: unknown, into: Record<string, number>): void {
  if (Array.isArray(node)) { for (const n of node) count_nodes(n, into); return; }
  if (node === null || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (typeof o["type"] === "string" && ("content" in o || "attrs" in o || "text" in o)) into[o["type"]] = (into[o["type"]] ?? 0) + 1;
  for (const v of Object.values(o)) count_nodes(v, into);
}

export async function observe(w: World, run_id: string, lesson_id: string): Promise<S3Observed> {
  const jobs = await w.query<JobRow>(
    "select status, repairs, truncation_retries, failure_reasons_json, brakes_fired from lesson_job where run_id=$1 and lesson_id=$2 order by queued_at desc limit 1", [run_id, lesson_id]);
  const job = jobs[0];
  const calls = await w.query<CallRow>(
    "select purpose, attempt, status, stop_reason, served_model, requested_model, input_tokens, output_tokens, cost_usd::text as cost_usd, raw_output from model_call where run_id=$1 order by sent_at, attempt", [run_id]);
  const versions = await w.query<{ lesson_json: StoredLesson; draft_json: unknown }>(
    "select lesson_json, draft_json from lesson_version where lesson_id=$1 order by number desc limit 1", [lesson_id]);
  const version = versions[0];
  const lesson = version?.lesson_json ?? null;
  const draft = version === undefined ? null : LessonDraft.safeParse(version.draft_json);

  const run = (await w.query<{ unit_id: string }>("select unit_id from run where id=$1", [run_id]))[0];
  const prov = (await w.query<{ prompt_version_id: string; prompt_number: number; locked_hash: string }>(
    "select p.id as prompt_version_id, p.number as prompt_number, p.locked_hash from run r join prompt_version p on p.id = r.prompt_version_id where r.id = $1", [run_id]))[0];
  const first_draft = calls.find((c) => c.purpose === "lesson_draft" && c.attempt === 1);
  // M-31: the original output must parse AND compile (the same classifier the full-run report uses).
  const initial = first_draft === undefined
    ? null
    : assess_initial_draft(first_draft.status === "completed" ? first_draft.raw_output : null, {
      row: w.rows.find((r) => r.lesson_id === lesson_id) ?? null, unit_id: (run?.unit_id ?? "") as UnitId, schema_version: lesson?.schema_version ?? 1,
    });
  const first_pass: boolean | null = initial === null || initial.stage === "no_output" ? null : initial.stage === "compiled";

  const node_types: Record<string, number> = {};
  if (lesson !== null) count_nodes(lesson.sections, node_types);
  const origins = new Map<string, string>();
  for (const b of draft?.success ? draft.data.blocks : []) b.standard_codes.forEach((c, i) => { if (!origins.has(c)) origins.set(c, b.code_origins[i] ?? ""); });
  for (const s of lesson?.front_matter.standards ?? []) if (s.role === "focus" && !origins.has(s.code)) origins.set(s.code, s.origin);

  let link: S3Observed["link"] = null;
  let tags: string[] = [];
  let parts = 0;
  if (lesson !== null) {
    const ctx = make_ctx(lesson);
    tags = cfu_tags(ctx).map((t) => t.code);
    parts = teaching_parts(lesson).length;
    const rows = await w.query<{ id: string; from_lesson_id: string; to_lesson_id: string; kind: LessonLinkRecord["kind"]; slot_id: string }>(
      "select id::text as id, from_lesson_id, to_lesson_id, kind, slot_id from lesson_link where from_lesson_id=$1 order by id", [lesson_id]);
    if (rows.length > 0) {
      ctx.links = rows.map((r) => ({ link_id: r.id, from_lesson_id: r.from_lesson_id, from_address: `${lesson_id}.Homework`, to_lesson_id: r.to_lesson_id, to_slot_id: r.slot_id, kind: r.kind, label: "" }));
      const issues = merge_resolutions(cross_lesson_link_rule.run(ctx, CHECK_POLICY), []);
      const blocks: string[] = [];
      if (!submit_gate(gate_state({ action: "submit", issues })).allowed) blocks.push("submit");
      if (!approve_gate(gate_state({ action: "approve", issues })).allowed) blocks.push("approve");
      link = { present: true, blocks };
    } else link = { present: false, blocks: [] };
  }

  const sections = (lesson?.sections ?? []).map((s) => ({ name: s.name, minutes: s.minutes }));
  return {
    run_state: job?.status ?? "missing",
    lesson_stored: version !== undefined && job?.status === "ready",
    draft: draft?.success ? { blocks: draft.data.blocks.map((b) => ({ role: b.role, section: b.section, part: b.part, standard_codes: b.standard_codes, code_origins: b.code_origins })) } : null,
    schema_valid_first_pass: first_pass,
    initial_stage: initial?.stage ?? null,
    provenance: { prompt_version_id: prov?.prompt_version_id ?? null, prompt_number: prov?.prompt_number ?? null, locked_hash: prov?.locked_hash ?? null },
    repairs_used: job?.repairs ?? 0,
    truncation_retries: job?.truncation_retries ?? 0,
    sections,
    minutes_total: lesson === null ? null : sections.reduce((a, s) => a + s.minutes, 0),
    node_types,
    codes: [...origins.entries()].map(([code, origin]) => ({ code, origin: origin === "" ? null : origin })),
    cfu_tags: tags,
    teaching_parts: parts,
    link,
    failure_reasons: (job?.failure_reasons_json ?? []).map((r) => ({ check: r.check, check_kind: r.check_kind ?? null })),
    brakes: job?.brakes_fired ?? [],
    calls: calls.map(({ raw_output: _raw, ...c }) => c),
  };
}
