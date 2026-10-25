// NL-98 oracle: synthetic rows for SCR-8 / CON-9 / CON-10, inserted with plain SQL. The sort below is written
// independently of sort_rows in board-service.ts on purpose (the expected order must not come from the code under test).
import { createHash } from "node:crypto";
import { db } from "../support/db";
import { createUser, type Role, type TestUser } from "../support/users";

export type SeedState = "generation_failed" | "draft" | "in_review" | "submitted" | "changes_requested" | "reopened" | "approved" | "exported";
export interface SeedLesson { number: number; state: SeedState; blocking: number; confirmation: number; advisory: number; reviewer?: string }
export interface Seeded {
  unit_id: "G6.U4"; unit_key: "g6-u4"; lessons: SeedLesson[]; reviewers: TestUser[]; sendBackBy: TestUser;
  expectedOrder: string[]; expectedRollup: Record<SeedState, number>;
}

export const PASSWORD = "Con9-Synthetic-Pass-1";
export const STATES: readonly SeedState[] = ["generation_failed", "draft", "in_review", "submitted", "changes_requested", "reopened", "approved", "exported"];
const ACTIVE = new Set<SeedState>(["draft", "in_review", "submitted", "changes_requested", "reopened"]);

/** Number -> state for the 47-lesson main unit. 4/6/8 wait on 5/7/9 (see seedMainUnit). */
const STATE_BY_NUMBER: SeedState[] = [
  "generation_failed", "generation_failed", "generation_failed", // 1-3
  "draft", "draft", "draft", "in_review", "draft", "reopened", // 4-9
];
const REST: [SeedState, number][] = [
  ["draft", 6], ["in_review", 9], ["submitted", 6], ["changes_requested", 4], ["reopened", 1], ["approved", 9], ["exported", 3],
];
for (const [s, n] of REST) for (let i = 0; i < n; i++) STATE_BY_NUMBER.push(s);

export const MAIN_PLAN: readonly SeedLesson[] = STATE_BY_NUMBER.map((state, i) => {
  const number = i + 1;
  // Small value ranges on purpose: many equal blocking, equal blocking+advisory and fully equal rows.
  const failed = state === "generation_failed";
  const tied = number >= 30 && number <= 32; // lessons 30-32 carry identical counts: only the lesson number splits them
  return {
    number, state,
    blocking: failed ? (number === 2 ? 3 : 0) : tied ? 2 : (number * 7) % 4,
    advisory: failed ? 0 : tied ? 1 : (number * 5) % 3,
    confirmation: failed ? 0 : tied ? 1 : Math.floor(number / 3) % 3,
  };
});

export function expectedOrder(plan: readonly SeedLesson[], unit_id = "G6.U4"): string[] {
  const grp = (l: SeedLesson) => (l.state === "generation_failed" ? 0 : ACTIVE.has(l.state) ? 1 : 2);
  const sorted = [...plan];
  for (let i = 1; i < sorted.length; i++) { // insertion sort with an explicit comparison chain
    const x = sorted[i]!;
    let j = i - 1;
    while (j >= 0 && before(x, sorted[j]!)) { sorted[j + 1] = sorted[j]!; j--; }
    sorted[j + 1] = x;
  }
  function before(a: SeedLesson, b: SeedLesson): boolean {
    if (grp(a) !== grp(b)) return grp(a) < grp(b);
    if (grp(a) === 1) {
      if (a.blocking !== b.blocking) return a.blocking > b.blocking;
      if (a.advisory !== b.advisory) return a.advisory > b.advisory;
      if (a.confirmation !== b.confirmation) return a.confirmation > b.confirmation;
    }
    return a.number < b.number;
  }
  return sorted.map((l) => `${unit_id}.L${l.number}`);
}

export function rollupOf(plan: readonly SeedLesson[]): Record<SeedState, number> {
  const r = Object.fromEntries(STATES.map((s) => [s, 0])) as Record<SeedState, number>;
  for (const l of plan) r[l.state]++;
  return r;
}

export const hashOf = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Stable synthetic user per tag: same email and password across spec files, created once. */
export async function user(role: Role, tag: string): Promise<TestUser> {
  const email = `con9-${tag}@example.test`;
  const [row] = await db().query<{ id: string; name: string }>("select id, name from app_user where email=$1", [email]);
  if (row) return { user_id: row.id, email, name: row.name, role, synthetic: true, password: PASSWORD };
  return createUser(role, { email, password: PASSWORD });
}

export async function ensureUnit(unit_id: string, outline: boolean): Promise<void> {
  const g = Number(/^G(\d+)\./.exec(unit_id)![1]);
  const u = Number(/\.U(\d+)$/.exec(unit_id)![1]);
  await db().query("insert into unit (id, grade, title) values ($1,$2,$3) on conflict (id) do nothing", [unit_id, g, `Grade ${g} · Unit ${u}`]);
  if (outline) {
    const uploader = await user("author", "uploader");
    await db().query(
      `insert into outline_version (id, unit_id, number, sha256, source_kind, source_name, uploaded_by)
       values ($1,$2,1,$3,'csv','synthetic-con9.csv',$4) on conflict (id) do nothing`,
      [`${unit_id}.ov1`, unit_id, hashOf(`ov:${unit_id}`), uploader.user_id],
    );
  }
}

export async function addIssues(lesson_id: string, hash: string, c: { blocking: number; confirmation: number; advisory: number }, at?: string): Promise<void> {
  let i = 0;
  for (const level of ["blocking", "confirmation", "advisory"] as const) {
    for (let k = 0; k < c[level]; k++, i++) {
      await db().query(
        `insert into issue (id, lesson_id, content_hash, level, kind, message, created_at)
         values ($1,$2,$3,$4,'e2e','synthetic', coalesce($5::timestamptz, now()) + ($6 || ' milliseconds')::interval)`,
        [`iss_${hash.slice(0, 8)}_${lesson_id}_${level}_${k}_${Date.now()}`, lesson_id, hash, level, at ?? null, String(i)],
      );
    }
  }
}

export async function setLessonHash(lesson_id: string, hash: string): Promise<void> {
  const [n] = await db().query<{ n: number }>("select coalesce(max(number),0)+1 as n from lesson_version where lesson_id=$1", [lesson_id]);
  await db().query(
    `insert into lesson_version (id, lesson_id, number, kind, content_hash, lesson_json, provenance_json, teacher_word_count)
     values ($1,$2,$3,'generated',$4,'{}','{}',0)`,
    [`${lesson_id}.v${n!.n}`, lesson_id, n!.n, hash],
  );
}

export async function seedUnit(unit_id: string, plan: readonly SeedLesson[], opts: { outline?: boolean; titles?: Record<number, string> } = {}): Promise<void> {
  await ensureUnit(unit_id, opts.outline ?? false);
  for (const l of plan) {
    const id = `${unit_id}.L${l.number}`;
    const hash = hashOf(id);
    await db().query(
      `insert into lesson (id, unit_id, number, type, title, state, reviewer_id, schema_version, current_version_id)
       values ($1,$2,$3,'lesson',$4,$5,$6,1,$7)`,
      [id, unit_id, l.number, opts.titles?.[l.number] ?? `Synthetic lesson ${l.number}`, l.state, l.reviewer ?? null, `${id}.v1`],
    );
    await db().query(
      `insert into lesson_version (id, lesson_id, number, kind, content_hash, lesson_json, provenance_json, teacher_word_count, stored_at)
       values ($1,$2,1,'generated',$3,'{}','{}',0,'2026-01-01T00:00:00Z')`,
      [`${id}.v1`, id, hash],
    );
    if (l.number % 5 === 0) { // one resolved blocking issue, oldest: must never be counted
      await db().query(
        `insert into issue (id, lesson_id, content_hash, level, kind, message, resolved_at, created_at)
         values ($1,$2,$3,'blocking','e2e','synthetic','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`,
        [`iss_${id}_resolved`, id, hash],
      );
    }
    await addIssues(id, hash, l, "2026-01-02T00:00:00Z");
  }
}

export async function seedMetrics(unit_id: string, rows: { lesson: number; minutes: number; g2: number }[]): Promise<void> {
  for (const r of rows) {
    const id = `${unit_id}.L${r.lesson}`;
    await db().query(
      `insert into lesson_metrics (lesson_id, version_id, active_minutes, teacher_word_count, g2_threshold_minutes, draft_rating, human_sessions, approved_at)
       values ($1,$2,$3,0,$4,1,1,'2026-01-03T00:00:00Z') on conflict do nothing`,
      [id, `${id}.v1`, r.minutes, r.g2],
    );
  }
}

/** from waits on to for slot_id. filled = the source lesson has a lesson_doc whose derived_json fills the slot. */
export async function linkLessons(unit_id: string, from: number, to: number, slot_id: string, opts: { filled: boolean }): Promise<void> {
  await db().query(
    "insert into lesson_link (outline_version_id, from_lesson_id, to_lesson_id, kind, slot_id) values ($1,$2,$3,'excerpt',$4)",
    [`${unit_id}.ov1`, `${unit_id}.L${from}`, `${unit_id}.L${to}`, slot_id],
  );
  if (opts.filled) {
    const derived = { sections: [{ content: { type: "doc", content: [{ type: "excerpt_slot", attrs: { slot_id, source_ref: "synthetic-source" } }] } }] };
    await db().query(
      `insert into lesson_doc (lesson_id, seq, store_id, ydoc_bytes, derived_json, content_hash, state_vector, schema_version)
       values ($1,1,'e2e','\\x00',$2::jsonb,$3,'\\x00',1) on conflict do nothing`,
      [`${unit_id}.L${to}`, JSON.stringify(derived), hashOf(`${unit_id}.L${to}`)],
    );
  }
}

export async function addSendBack(lesson_id: string, by: TestUser, tag: string, note: string): Promise<void> {
  await db().query(
    `insert into review_event (id, lesson_id, from_state, to_state, actor_id, reason_tag, note, at)
     values ($1,$2,'in_review','changes_requested',$3,$4,$5,'2026-01-04T00:00:00Z')`,
    [`rev_${lesson_id}_${tag}`, lesson_id, by.user_id, tag, note],
  );
}

export async function seedMainUnit(): Promise<Seeded> {
  const unit_id = "G6.U4" as const;
  const reviewers = [await user("reviewer", "rev1"), await user("reviewer", "rev2"), await user("reviewer", "rev3")];
  const sendBackBy = await user("reviewer", "sender");
  const base = { unit_id, unit_key: "g6-u4" as const, reviewers, sendBackBy, expectedOrder: expectedOrder(MAIN_PLAN), expectedRollup: rollupOf(MAIN_PLAN) };
  if ((await db().count("lesson", "unit_id=$1", [unit_id])) > 0) return { ...base, lessons: planWithReviewers(reviewers) };
  const lessons = planWithReviewers(reviewers);
  await seedUnit(unit_id, lessons, { outline: true });
  await linkLessons(unit_id, 4, 5, "L5.excerpt_1", { filled: false }); // slot_empty: lesson 5 has no lesson_doc
  await linkLessons(unit_id, 6, 7, "L7.excerpt_1", { filled: true }); // waiting_for_source_approval: lesson 7 in review
  await linkLessons(unit_id, 8, 9, "L9.excerpt_1", { filled: true }); // lesson 9 reopened: waiting + source_reopened
  const crs = lessons.filter((l) => l.state === "changes_requested").slice(0, 2);
  await addSendBack(`${unit_id}.L${crs[0]!.number}`, sendBackBy, "standards", "Check the standard code.");
  await addSendBack(`${unit_id}.L${crs[1]!.number}`, sendBackBy, "eld_support", "Add a sentence frame.");
  const approved = lessons.filter((l) => l.state === "approved").slice(0, 3);
  await seedMetrics(unit_id, approved.map((l, i) => ({ lesson: l.number, minutes: [20, 24, 28][i]!, g2: [18, 22, 30][i]! })));
  return { ...base, lessons };
}

function planWithReviewers(reviewers: TestUser[]): SeedLesson[] {
  let k = 0;
  return MAIN_PLAN.map((l) => (["in_review", "submitted", "changes_requested", "reopened", "approved", "exported"].includes(l.state)
    ? { ...l, reviewer: reviewers[k++ % 3]!.user_id } : { ...l }));
}

async function once(unit_id: string, fn: () => Promise<void>): Promise<void> {
  if ((await db().count("lesson", "unit_id=$1", [unit_id])) === 0) await fn();
}

/** G6.U6: 47 draft lessons, no lesson_metrics rows (north-star empty). */
export async function seedEmptyTileUnit(): Promise<void> {
  await once("G6.U6", () => seedUnit("G6.U6", Array.from({ length: 47 }, (_, i) => ({ number: i + 1, state: "draft" as const, blocking: i % 3, confirmation: 0, advisory: 0 })), { outline: true }));
}

/** G6.U7: three approved lessons, one reviewer, metrics 20/24/28 -> segment label "one reviewer, n = 3". */
export async function seedOneReviewerUnit(): Promise<TestUser> {
  const rev = await user("reviewer", "solo");
  await once("G6.U7", async () => {
    const plan: SeedLesson[] = [1, 2, 3].map((n) => ({ number: n, state: "approved" as const, blocking: 0, confirmation: 0, advisory: 0, reviewer: rev.user_id }));
    await seedUnit("G6.U7", plan, { outline: true });
    await seedMetrics("G6.U7", [{ lesson: 1, minutes: 20, g2: 18 }, { lesson: 2, minutes: 24, g2: 22 }, { lesson: 3, minutes: 28, g2: 30 }]);
  });
  return rev;
}

/** A unit with an outline version and no lessons (empty first use). */
export async function seedBareUnit(unit_id: string): Promise<void> {
  await ensureUnit(unit_id, true);
}

/** A run row, for the "run in progress" banner and the failed-row Retry link. */
export async function insertRun(unit_id: string, state: "running" | "complete", starter: TestUser): Promise<string> {
  await db().query(
    `insert into prompt_version (id, locked_hash, guidance_text, number) values ('pv_e2e_con9', $1, 'synthetic', 9001) on conflict (id) do nothing`,
    [hashOf("pv_e2e_con9")],
  );
  const id = `run_e2e_con9_${unit_id.replace(".", "_")}_${state}`;
  await db().query(
    `insert into run (id, unit_id, outline_version_id, kind, state, scope_json, prompt_version_id, choices_json, choices_hash, cap_usd, idempotency_key, started_by)
     values ($1,$2,$3,'full',$4,'{}','pv_e2e_con9','[]',$5,1,$6,$7) on conflict (id) do nothing`,
    [id, unit_id, `${unit_id}.ov1`, state, hashOf(id), `idem_${id}`, starter.user_id],
  );
  return id;
}

export async function seedUnitOnce(unit_id: string, plan: readonly SeedLesson[], opts: { outline?: boolean } = {}): Promise<void> {
  await once(unit_id, () => seedUnit(unit_id, plan, opts));
}
