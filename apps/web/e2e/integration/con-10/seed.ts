// NL-104 seed: synthetic stored rows for CON-10 / SCR-19, inserted with plain SQL. Every id, hash and name is synthetic.
// lesson_metrics is append-only, so each unit is seeded once (guarded by a unit-row check) and never reset.
import { createHash } from "node:crypto";
import { db } from "../support/db";
import { createUser, type Role, type TestUser } from "../support/users";

export interface SeedUnit { unit_id: string; unit_key: string }
export const UNITS = {
  main: { unit_id: "G7.U1", unit_key: "g7-u1" },
  many: { unit_id: "G7.U2", unit_key: "g7-u2" },
  empty: { unit_id: "G7.U3", unit_key: "g7-u3" },
  sparse: { unit_id: "G7.U4", unit_key: "g7-u4" },
} as const satisfies Record<string, SeedUnit>;

export const PASSWORD = "Con10-Synthetic-Pass-1";
export const MARKUP_TITLE = "<img src=x onerror=window.__pwn=1>";
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

export async function user(role: Role, tag: string): Promise<TestUser> {
  const email = `con10-${tag}@example.test`;
  const [row] = await db().query<{ id: string; name: string }>("select id, name from app_user where email=$1", [email]);
  if (row) return { user_id: row.id, email, name: row.name, role, synthetic: true, password: PASSWORD };
  return createUser(role, { email, password: PASSWORD });
}

const doc = (words: string[]): string => JSON.stringify({ text: words.join(" ") });

interface LessonSeed {
  n: number; reviewer: string; v1: string[]; v2: string[]; minutes: number; humans: number; rating: number;
  blocking: boolean; advisory: boolean; day: number;
}

async function seedLesson(unit: SeedUnit, l: LessonSeed, g2 = 25): Promise<string> {
  const id = `${unit.unit_id}.L${l.n}`;
  const h1 = sha(`${id}.v1`);
  const h2 = sha(`${id}.v2`);
  await db().query(
    `insert into lesson (id, unit_id, number, type, title, state, reviewer_id, schema_version, current_version_id)
     values ($1,$2,$3,'lesson',$4,'approved',$5,1,$6)`,
    [id, unit.unit_id, l.n, `Synthetic lesson ${l.n}`, l.reviewer, `${id}.v2`],
  );
  await db().query(
    `insert into lesson_version (id, lesson_id, number, kind, content_hash, lesson_json, provenance_json, teacher_word_count)
     values ($1,$2,1,'generated',$3,$4::jsonb,'{}',0), ($5,$2,2,'edited',$6,$7::jsonb,'{}',0)`,
    [`${id}.v1`, id, h1, doc(l.v1), `${id}.v2`, h2, doc(l.v2)],
  );
  if (l.blocking) {
    await db().query(`insert into issue (id, lesson_id, content_hash, level, kind, message) values ($1,$2,$3,'blocking','e2e','synthetic')`, [`iss_${id}_b`, id, h1]);
  }
  if (l.advisory) {
    await db().query(`insert into issue (id, lesson_id, content_hash, level, kind, message) values ($1,$2,$3,'advisory','e2e','synthetic')`, [`iss_${id}_a`, id, h1]);
  }
  await db().query(
    `insert into lesson_metrics (lesson_id, version_id, active_minutes, teacher_word_count, g2_threshold_minutes, draft_rating, human_sessions, approved_at)
     values ($1,$2,$3,0,$4,$5,$6, ('2026-03-' || lpad($7::text,2,'0') || 'T10:00:00Z')::timestamptz)`,
    [id, `${id}.v2`, l.minutes, g2, l.rating, l.humans, l.day],
  );
  await db().query(
    `insert into review_event (id, lesson_id, from_state, to_state, actor_id) values ($1,$2,'in_review','submitted',$3)`,
    [`rev_${id}_sub`, id, l.reviewer],
  );
  return id;
}

async function ensureUnit(unit: SeedUnit, title: string, confirmed: boolean, uploader: string): Promise<void> {
  const g = Number(/^G(\d+)\./.exec(unit.unit_id)![1]);
  await db().query("insert into unit (id, grade, title) values ($1,$2,$3)", [unit.unit_id, g, title]);
  await db().query(
    `insert into outline_version (id, unit_id, number, sha256, source_kind, source_name, uploaded_by, confirmed_at)
     values ($1,$2,1,$3,'csv','synthetic-con10.csv',$4,$5)`,
    [`${unit.unit_id}.ov1`, unit.unit_id, sha(unit.unit_id), uploader, confirmed ? "2026-03-01T00:00:00Z" : null],
  );
}

async function seedMain(rev: TestUser, author: TestUser): Promise<void> {
  const u = UNITS.main;
  await ensureUnit(u, "Grade 7 · Unit 1", true, author.user_id);
  const four = ["a", "b", "c", "d"];
  const eight = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const rows: LessonSeed[] = [
    // V-4 hand check (jsonb::text adds `{"text":` and `}` tokens): 0, 1/5, 4/9, 1/5, 0 -> median 0.2
    { n: 1, reviewer: rev.user_id, v1: four, v2: four, minutes: 20, humans: 1, rating: 1, blocking: true, advisory: false, day: 2 },
    { n: 2, reviewer: rev.user_id, v1: four, v2: ["a", "b", "X", "d"], minutes: 24, humans: 1, rating: 2, blocking: true, advisory: false, day: 4 },
    { n: 3, reviewer: rev.user_id, v1: eight, v2: ["a", "B", "C", "D", "E", "f", "g", "h"], minutes: 28, humans: 1, rating: 2, blocking: false, advisory: true, day: 6 },
    { n: 4, reviewer: rev.user_id, v1: four, v2: ["a", "b", "c", "Y"], minutes: 12, humans: 1, rating: 3, blocking: false, advisory: false, day: 8 },
    { n: 5, reviewer: rev.user_id, v1: four, v2: four, minutes: 16, humans: 0, rating: 1, blocking: false, advisory: false, day: 10 },
  ];
  const ids: string[] = [];
  for (const r of rows) ids.push(await seedLesson(u, r));
  // L2 and L4 were sent back once
  for (const id of [ids[1]!, ids[3]!]) {
    await db().query(`insert into review_event (id, lesson_id, from_state, to_state, actor_id) values ($1,$2,'submitted','changes_requested',$3)`, [`rev_${id}_cr`, id, rev.user_id]);
  }
  // links on approved hashes: 4 distinct codes, 3 confirmed, 2 assessed; plus noise that must not count
  const h2 = (n: number): string => sha(`${u.unit_id}.L${n}.v2`);
  const link = (n: number, code: string, address: string, role: string, confirmed: boolean, hash = h2(n)) =>
    db().query(
      `insert into alignment_link (lesson_id, content_hash, code, address, role, origin, asserted_by, confirmed_by) values ($1,$2,$3,$4,$5,'generator','generator',$6)`,
      [`${u.unit_id}.L${n}`, hash, code, address, role, confirmed ? rev.user_id : null],
    );
  await link(1, "RL.7.1", "s1", "P", true);
  await link(2, "RL.7.1", "s2", "I", false); // same code again, unconfirmed: distinct codes stay 4
  await link(2, "RL.7.2", "s1", "A", true);
  await link(3, "RL.7.3", "s1", "A", true);
  await link(4, "RL.7.4", "s1", "I", false);
  await link(5, "RL.7.9", "s1", "A", true, sha(`${u.unit_id}.L5.v1`)); // on a generated hash, not an approved one: excluded
  // suggestions: 5, two accepted
  const sugg = ["accepted", "accepted", "rejected", "closed", "pending"];
  for (let i = 0; i < sugg.length; i++) {
    await db().query(
      `insert into suggestion (id, lesson_id, anchor_start, anchor_end, selected_text, suggested_text, status, requested_by, expires_at, model_call_id)
       values ($1,$2,'0','1','synthetic','synthetic',$3,$4,'2027-01-01T00:00:00Z','mc_e2e')`,
      [`sug_con10_${i}`, ids[i % 5], sugg[i], rev.user_id],
    );
  }
  // model_call cost on the five lessons: 5 x 0.50 = 2.50
  const mc = (id: string, run: string | null, lesson: string | null, cost: number) =>
    db().query(
      `insert into model_call (id, run_id, lesson_id, attempt, purpose, alias, requested_model, rendered_prompt, status, cost_usd)
       values ($1,$2,$3,1,'e2e','e2e','e2e','synthetic','completed',$4)`,
      [id, run, lesson, cost],
    );
  for (let i = 0; i < 5; i++) await mc(`mc_con10_l${i + 1}`, null, ids[i]!, 0.5);
  // runs: cap 10 spent 4.00 (40 %), cap 5 spent 4.50 (90 %) -> H-3 = 90, n 2
  await db().query(`insert into prompt_version (id, locked_hash, guidance_text, number) values ('pv_e2e_con10', $1, 'synthetic', 9010) on conflict (id) do nothing`, [sha("pv_e2e_con10")]);
  const run = (id: string, cap: number) =>
    db().query(
      `insert into run (id, unit_id, outline_version_id, kind, state, scope_json, prompt_version_id, choices_json, choices_hash, cap_usd, idempotency_key, started_by)
       values ($1,$2,$3,'full','complete','{}','pv_e2e_con10','[]',$4,$5,$6,$7)`,
      [id, u.unit_id, `${u.unit_id}.ov1`, sha(id), cap, `idem_${id}`, author.user_id],
    );
  await run("run_con10_a", 10);
  await run("run_con10_b", 5);
  await mc("mc_con10_ra", "run_con10_a", null, 4);
  await mc("mc_con10_rb", "run_con10_b", null, 4.5);
  // 8 lesson jobs: 7 ready, 1 failed; minutes apart so the nearest-rank p95 is the longest
  const mins = [2, 3, 4, 5, 6, 7, 9, 13];
  for (let i = 0; i < 8; i++) {
    await db().query(
      `insert into lesson_job (id, run_id, kind, status, tile_state, started_at, finished_at)
       values ($1,'run_con10_a','lesson',$2,$3,'2026-03-01T00:00:00Z', ('2026-03-01T00:00:00Z'::timestamptz + ($4 || ' minutes')::interval))`,
      [`job_con10_${i}`, i === 7 ? "generation_failed" : "ready", i === 7 ? "failed" : "ready", String(mins[i])],
    );
  }
}

async function seedMany(author: TestUser): Promise<void> {
  const u = UNITS.many;
  await ensureUnit(u, "Grade 7 · Unit 2", true, author.user_id);
  const revs = [await user("reviewer", "rev1"), await user("reviewer", "rev2"), await user("reviewer", "rev3")];
  const w = ["p", "q", "r", "s"];
  for (let i = 0; i < 3; i++) {
    await seedLesson(u, { n: i + 1, reviewer: revs[i]!.user_id, v1: w, v2: i === 0 ? w : ["p", "q", "r", "Z"], minutes: 18 + i * 3, humans: 1, rating: i + 1, blocking: i === 0, advisory: false, day: 12 + i });
  }
}

async function seedEmpty(author: TestUser, rev: TestUser): Promise<void> {
  const u = UNITS.empty;
  await ensureUnit(u, "Grade 7 · Unit 3", false, author.user_id);
  for (let n = 1; n <= 3; n++) {
    await db().query(
      `insert into lesson (id, unit_id, number, type, title, state, reviewer_id, schema_version) values ($1,$2,$3,'lesson',$4,'draft',$5,1)`,
      [`${u.unit_id}.L${n}`, u.unit_id, n, `Synthetic lesson ${n}`, rev.user_id],
    );
  }
}

async function seedSparse(author: TestUser, rev: TestUser): Promise<void> {
  const u = UNITS.sparse;
  await ensureUnit(u, MARKUP_TITLE, false, author.user_id); // markup in the unit title: must render as text (AC-6)
  await seedLesson(u, { n: 1, reviewer: rev.user_id, v1: ["x", "y"], v2: ["x", "y"], minutes: 10, humans: 1, rating: 1, blocking: false, advisory: false, day: 20 });
  await db().query("update lesson set title=$1 where id=$2", [MARKUP_TITLE, `${u.unit_id}.L1`]);
}

/** Idempotent: a unit row already present means that unit was seeded by an earlier spec file in this stack;
 * the global probe and eval rows are re-inserted when an earlier file's cleanup removed them. */
export function seedAll(): Promise<{ reviewers: TestUser[]; probe_ids: string[]; eval_id: string }> {
  return doSeed();
}

const PROBES = [
  { id: "pr_con10_a_http", kind: "http", p95: { lesson_open: 2000, board: 900 }, n: 1000 },
  { id: "pr_con10_b_http", kind: "http", p95: { lesson_open: 1200, board: 700 }, n: 4000 },
  { id: "pr_con10_c_yjs", kind: "yjs", p95: { remote_edit: 350 }, n: 900 },
];

async function doSeed(): Promise<{ reviewers: TestUser[]; probe_ids: string[]; eval_id: string }> {
  const rev = await user("reviewer", "rev1");
  const author = await user("author", "author");
  const approver = await user("approver", "approver");
  const seeded = async (u: SeedUnit) => (await db().count("unit", "id=$1", [u.unit_id])) > 0;
  if (!(await seeded(UNITS.main))) await seedMain(rev, author);
  if (!(await seeded(UNITS.many))) await seedMany(author);
  if (!(await seeded(UNITS.empty))) await seedEmpty(author, rev);
  if (!(await seeded(UNITS.sparse))) await seedSparse(author, rev);
  // Global rows: mutable tables, removed again by cleanupGlobal. Ids sort by time, so the _b / _c rows are the latest.
  for (const p of PROBES) {
    if ((await db().count("probe_run", "id=$1", [p.id])) === 0) {
      await db().query(
        `insert into probe_run (id, kind, users, duration_s, machine, provider_mode, p95_json, error_rate, lost_updates, event_loop_lag_p95_ms, max_db_connections, n)
         values ($1,$2,1,1,'e2e','stub',$3::jsonb,0,0,0,1,$4)`,
        [p.id, p.kind, JSON.stringify(p.p95), p.n],
      );
    }
  }
  for (const e of [{ id: "ev_con10_a", passed: 2, total: 5 }, { id: "ev_con10_b", passed: 4, total: 5 }]) {
    if ((await db().count("eval_run", "id=$1", [e.id])) === 0) {
      await db().query(
        `insert into eval_run (id, suite, git_sha, models_json, provider_mode, case_set, passed, total, finished_at)
         values ($1,'S10','e2e','{}'::jsonb,'stub','e2e',$2,$3,'2026-03-01T00:00:00Z')`,
        [e.id, e.passed, e.total],
      );
    }
  }
  return { reviewers: [rev, author, approver], probe_ids: PROBES.map((p) => p.id), eval_id: "ev_con10_b" };
}

/** probe_run and eval_run are mutable and global: delete exactly the rows this suite inserted. Safe to run twice. */
export async function cleanupGlobal(ids: { probe_ids: string[]; eval_id: string }): Promise<void> {
  await db().query("delete from probe_run where id = any($1::text[])", [ids.probe_ids]);
  await db().query("delete from eval_run where id = any($1::text[])", [["ev_con10_a", ids.eval_id]]);
}
