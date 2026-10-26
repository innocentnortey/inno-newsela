import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CHECK_RULES } from "@ls/core/checks/registry";
import { make_ctx } from "@ls/core/checks/test-helpers";
import type { CheckContext } from "@ls/core/checks/types";
import type { OutlineRepo, RowContext } from "@ls/core/ports/outlines";
import type { PromptRepo, PromptVersionRow } from "@ls/core/ports/prompts";
import type { RunRepo, RunRow, UnitPlanRow } from "@ls/core/ports/runs";
import type { StandardRepo, StandardRow } from "@ls/core/ports/standards";
import type { ClaimedJob } from "@ls/core/ports/job-queue";
import { load_worker_settings } from "@ls/config/settings";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { NormalizedRow } from "@ls/schema/outline";
import type { UnitPlanDraft } from "@ls/schema/unit-plan";
import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked";
import { PromptRenderer } from "@ls/prompts/render";
import { SchemaRegistry } from "@ls/prompts/schemas";
import type { CheckContextLoaderPort } from "../collaborators.ts";
import { ulid_body } from "./scripted-paid-caller.ts";

export { CHECK_POLICY, CHECK_RULES };

const FIXTURES = fileURLToPath(new URL("../../../../../../packages/core/tests/fixtures/", import.meta.url));
const read = (n: string): unknown => JSON.parse(readFileSync(`${FIXTURES}${n}.json`, "utf8"));

export type Wp = "wp1" | "wp4";
export const load_row = (wp: Wp): NormalizedRow => NormalizedRow.parse(read(`row-${wp}`));
const base_draft = (wp: Wp): LessonDraft => LessonDraft.parse(read(`draft-${wp}`));
/**
 * The stored WP-1 test draft opens Learning in Action without the routine heading the Reading template requires
 * (WP-1 B table: "Percy's Voice"). The JSON stays as it is, because grounding tests address its blocks by position;
 * the routine is added here, copied from packages/llm/src/fixtures/draft-wp1.json.
 */
export function load_draft(wp: Wp): LessonDraft {
  const d = base_draft(wp);
  if (wp !== "wp1") return d;
  const at = d.blocks.findIndex((b) => b.section === "Learning in Action" && b.part === "Part A");
  const routine: LessonDraft["blocks"][number] = { role: "routine_heading", section: "Learning in Action", part: "Part A", text: "Percy's Voice", standard_codes: [], code_origins: [], cfu: null, minutes: null };
  return { ...d, blocks: [...d.blocks.slice(0, at), routine, ...d.blocks.slice(at)] };
}

/** WP-1 as stored: Look Back is 3 minutes (template 5, tolerance 1), so minutes_out_of_range fires. */
export const bad_wp1_draft = (): LessonDraft => load_draft("wp1");
/** The same draft with the Look Back block set to the template's 5 minutes. */
export function good_wp1_draft(): LessonDraft {
  const d = load_draft("wp1");
  return { ...d, blocks: d.blocks.map((b) => (b.section === "Look Back" && b.minutes !== null ? { ...b, minutes: 5 } : b)) };
}

export const id = (prefix: string, n: number): string => `${prefix}_${ulid_body(n)}`;

export function make_job(o: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    job_id: id("job", 1),
    run_id: id("run", 1),
    unit_id: "G6.U4",
    kind: "lesson",
    lesson_id: "G6.U4.L4",
    attempt: 1,
    lease_until: new Date("2026-01-01T00:05:00Z"),
    prompt_version_id: "pv_test_1",
    schema_version: 1,
    outline_version_id: "G6.U4.ov1",
    started_by: id("usr", 1),
    idempotency_key: "idem-1",
    reviewer_note: null,
    ...o,
  } as ClaimedJob;
}

export const make_settings = () =>
  load_worker_settings({ DATABASE_URL: "postgres://u:p@h:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" });

export function make_renderer(): PromptRenderer {
  return new PromptRenderer(LOCKED_DIR, new SchemaRegistry());
}

export function prompt_row(): PromptVersionRow {
  return { prompt_version_id: "pv_test_1", number: 1, locked_hash: locked_hash(LOCKED_DIR), guidance_text: "", author_id: null, reason: null, diff: null, created_at: new Date(0) } as PromptVersionRow;
}

export function row_context_of(row: NormalizedRow): RowContext {
  return { outline_version_id: "G6.U4.ov1", row, row_hash: "a".repeat(64), arc_header: null, neighbours: [], unit_rules: [], links: [], choices: [] } as RowContext;
}

export function standard_rows(row: NormalizedRow): StandardRow[] {
  const mk = (code: string, set: StandardRow["set"]): StandardRow => ({ code, set, text: `Official text of ${code}`, parent_code: null, is_leaf: true, eld_strand: null });
  const leaves = row.focus_codes.includes("L.6.4") ? LEAVES["L.6.4"]!.map((c) => ({ ...mk(c, "CA_CCSS_ELA_6"), parent_code: "L.6.4" })) : [];
  return [...row.focus_codes.map((c) => mk(c, "CA_CCSS_ELA_6")), ...leaves, ...row.msls_codes.map((c) => mk(c, "MSLS_6")), ...row.eld_codes.map((c) => mk(c, "CA_ELD_6"))];
}

/** Sub-codes of listed parents in the standards double (the real index answers leaves_of from the official rows). */
const LEAVES: Record<string, string[]> = { "L.6.4": ["L.6.4.a", "L.6.4.b"] };

export interface Repos {
  outlines: OutlineRepo;
  runs: RunRepo & { unit_plan_requests: string[]; pinned_requests: string[] };
  standards: StandardRepo;
  prompts: PromptRepo;
}

export function make_repos(row: NormalizedRow, plan: UnitPlanDraft | null = null, parent_run_id: string | null = null): Repos {
  const unit_plan_requests: string[] = [];
  const pinned_requests: string[] = [];
  const outlines = { row_context: async () => row_context_of(row) } as unknown as OutlineRepo;
  const runs = {
    unit_plan_requests,
    pinned_requests,
    pinned_choices: async (run_id: string) => (pinned_requests.push(run_id), []),
    get: async () => ({ parent_run_id }) as RunRow,
    unit_plan: async (run_id: string) => (unit_plan_requests.push(run_id), plan === null ? null : ({ plan } as UnitPlanRow)),
  } as unknown as Repos["runs"];
  const standards = {
    texts: async (codes: readonly string[]) => standard_rows(row).filter((s) => codes.includes(s.code)),
    index: async () => ({ leaves_of: (c: string) => LEAVES[c] ?? [], text_of: () => null, resolve: () => { throw new Error("unused"); } }),
  } as unknown as StandardRepo;
  const prompts = { get: async () => prompt_row() } as unknown as PromptRepo;
  return { outlines, runs, standards, prompts };
}

/** Builds a CheckContext from the compiled lesson via the core test helper, with the row's codes allowed. */
export function make_loader(row: NormalizedRow): CheckContextLoaderPort {
  const standards = standard_rows(row);
  return {
    load: async (_lesson_id, lesson, content_hash): Promise<CheckContext> => ({
      ...make_ctx(lesson),
      content_hash,
      row,
      allowed_codes: standards.map((s) => s.code),
      standards,
    }),
  };
}
