// `npx tsx evals/src/replay-finals-main.ts --run <run_id> [--which initial|final|both] [--lift-tags] [--out file.json]`
// --lift-tags: what-if that copies teacher_talk/paragraph codes onto the section's routine heading (see lift_teaching_tags).
// Re-checks the stored model outputs of one run on the CURRENT code: compile against the pinned outline row and template,
// then the generation rule set and the full review rule set. Reads the database through read-only sessions; no model call,
// nothing written to the database. DATABASE_URL names the database that holds the run. Cross-lesson links are omitted.
import { writeFileSync } from "node:fs";
import { read_secret_url } from "@ls/config/env";
import { PgDatabase } from "@ls/db/pool";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { CHECK_RULES, run_checks } from "@ls/core/checks/registry";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import { PgAlignmentRepo, PgSafetyFlagRepo, PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { CompileCheckNode } from "@ls/worker/generation/nodes/compile-check-node";
import { generation_rules } from "@ls/worker/wiring/generation";
import { lift_teaching_tags, pick_output, summarize, type ReplayFinding, type ReplayRecord, type Which } from "./replay-finals.ts";

const arg = (n: string): string | undefined => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? undefined : process.argv[i + 1]; };
const run_id = arg("run");
if (run_id === undefined) { console.error("usage: --run <run_id> [--which initial|final|both] [--out file.json]"); process.exit(2); }
const lift = process.argv.includes("--lift-tags");
const whiches: Which[] = arg("which") === "initial" ? ["initial"] : arg("which") === "final" ? ["final"] : ["initial", "final"];

const env = { ...process.env };
const base = env["DATABASE_URL"] ?? "";
env["DATABASE_URL"] = base.includes("?") ? base : `${base}?options=-c%20default_transaction_read_only%3Don`;
const db = new PgDatabase({ database_url: read_secret_url(env, "DATABASE_URL", ["postgres:", "postgresql:"]), pg_pool_max: 2, build_id: "replay", log_level: "info" } as never, 2, 5000, "worker");
const d = { db, ids: new PrefixedIdGenerator(), clock: new SystemClock() } as never;
const outlines = new PgOutlineRepo(d), standards = new PgStandardRepo(d), lessons = new PgLessonRepo(d);
const real = new CheckContextLoader(outlines, standards, lessons, new PgLessonDocReader({ db } as never), new PgSuggestionRepo(d), new PgSafetyFlagRepo(d), new PgAlignmentRepo(d), new SystemClock());
let last: Awaited<ReturnType<typeof real.load>> | null = null;
const loader = {
  async load(...a: Parameters<typeof real.load>) {
    const c = await real.load(...a);
    last = { ...c, links: [], linked_lessons: [], linked_states: {} };
    return last;
  },
};
const node = new CompileCheckNode(loader as never, generation_rules(CHECK_RULES), CHECK_POLICY, standards as never);
const q = async (s: string, p: unknown[] = []): Promise<any[]> => db.with_tx(async (tx: any) => (await tx.query(s, p)).rows);
const shape = (fs: readonly ReplayFinding[]): ReplayFinding[] =>
  fs.map((f) => ({ kind: f.kind, level: f.level, message: f.message, address: f.address, code: f.code, ...(f.matched !== undefined ? { matched: f.matched } : {}) }));

const jobs = await q(`select id, run_id, lesson_id, status from lesson_job where run_id=$1 and lesson_id is not null order by lesson_id`, [run_id]);
const idx = await standards.index();
const out: ReplayRecord[] = [];
for (const j of jobs) {
  const calls = await q(`select purpose, raw_output from model_call where job_id=$1 and purpose in ('lesson_draft','repair') order by sent_at`, [j.id]);
  const units = await outlines.list_units();
  const ver = (await lessons.source_outline_version(j.lesson_id)) ?? units.find((u: any) => j.lesson_id.startsWith(u.unit_id))?.latest_outline_version_id;
  const rc = await outlines.row_context(ver as never, j.lesson_id, null);
  const codes = [...new Set([...rc.row.focus_codes, ...rc.row.eld_codes, ...rc.row.msls_codes].flatMap((c: string) => idx.leaves_of(c)))];
  const texts = await standards.texts(codes);
  const unit_id = j.lesson_id.slice(0, j.lesson_id.lastIndexOf("."));
  for (const which of whiches) {
    const picked = pick_output(calls, which);
    const raw_output = picked !== null && lift ? lift_teaching_tags(picked) : picked;
    const rec: ReplayRecord = { lesson: j.lesson_id, which, status: j.status, schema_issues: [], compile_error: null, gen: null, review: null };
    if (raw_output === null) { rec.compile_error = "no_output"; out.push(rec); continue; }
    last = null;
    const state: any = { job: { job_id: j.id, run_id: j.run_id, unit_id, lesson_id: j.lesson_id, schema_version: 1, prompt_version_id: "replay" }, context: { row_context: rc, standards: texts, raw_output, calls: [] } };
    const res = await node.run(state);
    rec.schema_issues = [...(res.schema_issues ?? [])];
    rec.compile_error = res.compile_error ?? null;
    if (res.check_result && last) {
      rec.gen = shape(res.check_result.findings);
      rec.review = shape(run_checks(last, CHECK_RULES, CHECK_POLICY).findings);
    }
    out.push(rec);
  }
}
await db.close();
const file = arg("out");
if (file) writeFileSync(file, JSON.stringify(out, null, 1));
for (const which of whiches) console.log(which, JSON.stringify(summarize(out.filter((r) => r.which === which)), null, 1));
