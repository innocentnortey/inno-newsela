// `npx tsx evals/src/replay-finals-main.ts --run <run_id> [--which original,effective,last_repair,final] [--lift-tags]
//    [--review-context generation_time|current] [--label text] [--out file.json] [--messages]`
// Re-checks the stored model outputs of one run on the CURRENT code ("current-code reanalysis", never the run's own metric):
// compile against the run's pinned outline row and choices, then the generation rule set and the full review rule set.
// Read-only (enforced, see replay-finals-readonly.ts); no model call; nothing is written to the database. DATABASE_URL names
// the database that holds the run and is the only URL ever used. --lift-tags is a SIMULATION (see lift_teaching_tags).
// Exit codes: 2 usage, 3 setup failure, 4 identity failure, 5 row counts changed.
import { writeFileSync } from "node:fs";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import { PgAlignmentRepo, PgSafetyFlagRepo, PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { PgRunRepo } from "@ls/db/repos/runs";
import {
  calibrate, historical_summary, input_hash, rate_text, summarize,
  type HistoricalOutcome, type ReplayRecord, type ReviewContextMode, type StoredCall, type Which,
} from "./replay-finals.ts";
import { make_replay_env, type InputItem, type LoaderPorts, type ReplayJob } from "./replay-finals-lesson.ts";
import { ReplayIdentityError, load_run_pin } from "./replay-finals-pin.ts";
import { claims_text, collect_code_identity, collect_identities, omissions, type ReplayProvenance } from "./replay-finals-provenance.ts";
import { ReplaySetupError, connect_read_only, row_counts, same_counts } from "./replay-finals-readonly.ts";

const USAGE = "usage: --run <run_id> [--which original,effective,last_repair,final (default effective,final)] [--lift-tags] [--review-context generation_time|current] [--label text] [--out file.json] [--messages]";
const arg = (n: string): string | undefined => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? undefined : process.argv[i + 1]; };
const WHICHES: readonly Which[] = ["original", "effective", "last_repair", "final"];
const run_id = arg("run");
const which_arg = arg("which") ?? "effective,final";
const whiches = which_arg.split(",") as Which[];
const mode = (arg("review-context") ?? "generation_time") as ReviewContextMode;
if (run_id === undefined || whiches.some((w) => !WHICHES.includes(w)) || (mode !== "generation_time" && mode !== "current")) { console.error(USAGE); process.exit(2); }
const lift = process.argv.includes("--lift-tags");
const messages = process.argv.includes("--messages");
const label = arg("label") ?? "";

const UTC = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;
const started_at = new Date();
let conn;
try {
  conn = await connect_read_only(process.env);
} catch (e) {
  console.error(`replay setup failed: ${e instanceof ReplaySetupError ? e.code : "unknown"}: ${e instanceof Error ? e.message : ""}`);
  process.exit(3);
}
const { db, evidence } = conn;
console.log(`read-only verified: database=${evidence.database} port=${String(evidence.port)} default_transaction_read_only=${evidence.default_transaction_read_only} transaction_read_only=${evidence.transaction_read_only} write_probe=${evidence.write_probe}`);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg rows are untyped
const q = async (s: string, p: unknown[] = []): Promise<any[]> => db.with_tx(async (tx) => (await tx.query(s, p)).rows);

try {
  const before = await row_counts(db);
  const d = { db, ids: new PrefixedIdGenerator(), clock: new SystemClock() } as never;
  const standards = new PgStandardRepo(d);
  const ports: LoaderPorts = {
    outlines: new PgOutlineRepo(d), standards, graph: new PgLessonRepo(d), reader: new PgLessonDocReader({ db } as never),
    suggestions: new PgSuggestionRepo(d), flags: new PgSafetyFlagRepo(d), alignment: new PgAlignmentRepo(d), clock: new SystemClock(),
  };
  const pin = await load_run_pin({
    runs: new PgRunRepo(d), prompts: new PgPromptRepo(d),
    raw_choices_json: async (id) => (await q("select choices_json from run where id=$1", [id]))[0]?.choices_json,
  }, run_id);
  const env = make_replay_env(ports, pin, {
    lift, review_context: mode, messages,
    first_stored_at: async (lesson_id) => (await q(`select to_char(min(stored_at) at time zone 'UTC', ${UTC}) as t from lesson_version where lesson_id=$1`, [lesson_id]))[0]?.t ?? null,
  });
  const jobs = await q(`select id, run_id, lesson_id, status, tile_state, repairs, truncation_retries, failure_reasons_json from lesson_job where run_id=$1 and kind='lesson' and lesson_id is not null order by lesson_id`, [run_id]);
  const records: ReplayRecord[] = [];
  const inputs: InputItem[] = [];
  for (const j of jobs) {
    const calls: StoredCall[] = (await q(`select id, purpose, attempt, status, stop_reason, raw_output, to_char(sent_at at time zone 'UTC', ${UTC}) as sent_at from model_call where job_id=$1 and purpose in ('lesson_draft','truncation_retry','repair')`, [j.id]))
      .map((c) => ({ id: c.id, purpose: c.purpose, attempt: c.attempt, status: c.status, stop_reason: c.stop_reason ?? null, raw_output: c.raw_output ?? null, sent_at: c.sent_at }));
    const historical: HistoricalOutcome = {
      tile_state: j.tile_state, repairs: j.repairs, truncation_retries: j.truncation_retries,
      // reason_key copied from evals/src/full-run-facts.ts (not imported: absent in older commits)
      failure_reasons: ((j.failure_reasons_json ?? []) as { check: string; check_kind?: string | null }[]).map((r) => (r.check_kind ? `${r.check}:${r.check_kind}` : r.check)),
    };
    const job: ReplayJob = { job_id: j.id, run_id: j.run_id, lesson_id: j.lesson_id, status: j.status, historical, calls };
    const out = await env.replay_job(job, whiches);
    records.push(...out.records);
    inputs.push(out.input);
  }
  const db_now = (await q(`select to_char(now() at time zone 'UTC', ${UTC}) as t`))[0]?.t as string;
  const calls_by_purpose: Record<string, number> = {};
  for (const r of await q("select purpose, count(*)::int as n from model_call where run_id=$1 group by purpose order by purpose", [run_id])) calls_by_purpose[r.purpose] = r.n;
  const after = await row_counts(db);
  const cmpc = same_counts(before, after);
  if (!cmpc.same) { console.error(`row counts changed during the replay: ${cmpc.differing.join(", ")}`); process.exit(5); }

  const code = collect_code_identity();
  const provenance: ReplayProvenance = {
    tool: "replay-finals", label, analysis: "current-code reanalysis", claims: claims_text(code.commit),
    started_at: started_at.toISOString(), finished_at: "", db_now, read_only: evidence, row_counts_before: before, row_counts_after: after,
    run: { run_id, unit_id: pin.unit_id, outline_version_id: pin.outline_version_id, prompt_version_id: pin.prompt_version_id, prompt_locked_hash: pin.prompt_locked_hash,
      choices_hash: pin.choices_hash, choices_hash_basis: pin.choices_hash_basis, choices_count: pin.choices.length, created_at: pin.created_at },
    code, identities: collect_identities(), review_context: mode, lift, whiches,
    input_hash: input_hash({ run: { run_id, outline_version_id: pin.outline_version_id, choices_hash: pin.choices_hash, prompt_version_id: pin.prompt_version_id }, review_context: mode, lift, whiches, lessons: inputs }),
    omissions: omissions(new Date(db_now), mode, env.trace_omissions()), calls_by_purpose,
  };
  const summaries = Object.fromEntries(whiches.map((w) => [w, summarize(records.filter((r) => r.which === w))]));
  provenance.finished_at = new Date().toISOString();
  const doc = { provenance, summaries, historical_outcome: historical_summary(records), calibration: calibrate(records), records };
  const file = arg("out");
  if (file) writeFileSync(file, JSON.stringify(doc, null, 1));

  console.log("analysis: current-code reanalysis (historical outcome printed separately)");
  console.log(`code: ${code.commit.slice(0, 12)} dirty_code_files=${code.dirty_files.length} review_context=${mode} lift=${String(lift)} input_hash=${provenance.input_hash.slice(0, 12)}`);
  console.log("historical outcome:", JSON.stringify(doc.historical_outcome));
  for (const w of whiches) {
    const s = summaries[w]!;
    console.log(`${w}: gen_pass ${rate_text(s.gen_pass, s)}; review_pass ${rate_text(s.review_pass, s)}; not_compiled ${s.not_compiled} (no_output ${s.no_output}, schema_invalid ${s.schema_invalid}, compile_error ${s.compile_error})`);
  }
  console.log("calibration (effective vs historical clean first pass):", JSON.stringify({ ...doc.calibration, of: records.filter((r) => r.which === "effective").length }));
} catch (e) {
  if (e instanceof ReplayIdentityError) { console.error(`replay identity failure: ${e.message}`); await db.close(); process.exit(4); }
  if (e instanceof ReplaySetupError) { console.error(`replay setup failed: ${e.code}: ${e.message}`); await db.close(); process.exit(3); }
  throw e;
}
await db.close();
