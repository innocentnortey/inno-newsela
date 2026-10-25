// NL-99: runs the compressed S8 script once per test run and caches the result in test-results (not committed).
// heartbeat-capture.spec.ts and s8-result-row.spec.ts share it, so a single --grep run still has its input.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgDatabase } from "@ls/db/pool";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import type { Browser, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser } from "../support/users";
import { expectedLessonSeconds, expectedUserSeconds } from "./oracle";
import { S8 } from "./script";
import { ensureSeeded, freshUnit, seedLesson } from "./seed";
import { drive, lessonUrl, logBeats, userContext, type BeatLog } from "./tabs";
import { DISCLOSURE_TEXT } from "./text";

export const RESULT_FILE = resolve(__dirname, "../../../test-results/con-20/script-result.json");

export interface LessonResult {
  lesson: number;
  lesson_id: string;
  script_seconds: number;
  stored_seconds: number;
  a_seconds: number;
  b_seconds: number;
  a_script_seconds: number;
  b_script_seconds: number;
  beats_sent: number;
}
export interface S8Result {
  stack: string;
  unit_id: string;
  lessons: LessonResult[];
  reviewer_names: string[];
  user_ids: string[];
}

export function cachedResult(): S8Result | null {
  if (!existsSync(RESULT_FILE)) return null;
  const r = JSON.parse(readFileSync(RESULT_FILE, "utf8")) as S8Result;
  return r.stack === getStack().databaseUrl ? r : null; // a result from an earlier stack points at a dropped database
}

export async function runS8(browser: Browser): Promise<S8Result> {
  await ensureSeeded();
  const unit = await freshUnit();
  const A = await createUser("reviewer", { synthetic: false });
  const B = await createUser("reviewer", { synthetic: false });
  const lessons = [];
  for (const seg of S8) lessons.push(await seedLesson({ unit, number: seg.lesson, state: "in_review", reviewer_id: A.user_id }));
  const a = await userContext(browser, A);
  const b = await userContext(browser, B);
  const results: LessonResult[] = [];
  try {
    for (const seg of S8) {
      const L = lessons[seg.lesson - 1]!;
      const opened: { page: Page; plan: (typeof seg.tabs)[number]; log: BeatLog }[] = [];
      for (const plan of seg.tabs) {
        const owner = plan.who === "A" ? a : b;
        const page = await owner.ctx.newPage();
        const log = logBeats(page);
        await page.goto(lessonUrl(L.unit_key, L.lesson_key));
        await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
        opened.push({ page, plan, log });
      }
      await drive(opened, seg.seconds);
      // let an in-flight beat land before reading
      await new Promise((r) => setTimeout(r, 1500));
      for (const o of opened) await o.page.close();
      const rows = await db().query<{ user_id: string; s: number }>(
        "select user_id, sum(active_seconds)::int as s from review_session where lesson_id = $1 and not synthetic group by user_id",
        [L.lesson_id],
      );
      const secs = (u: string) => rows.find((r) => r.user_id === u)?.s ?? 0;
      results.push({
        lesson: seg.lesson,
        lesson_id: L.lesson_id,
        script_seconds: expectedLessonSeconds(seg),
        stored_seconds: secs(A.user_id) + secs(B.user_id),
        a_seconds: secs(A.user_id),
        b_seconds: secs(B.user_id),
        a_script_seconds: expectedUserSeconds(seg, "A"),
        b_script_seconds: expectedUserSeconds(seg, "B"),
        beats_sent: opened.reduce((n, o) => n + o.log.bodies.length, 0),
      });
    }
  } finally {
    await a.ctx.close();
    await b.ctx.close();
  }
  const out: S8Result = { stack: getStack().databaseUrl, unit_id: unit.unit_id, lessons: results, reviewer_names: [A.name, B.name], user_ids: [A.user_id, B.user_id] };
  mkdirSync(dirname(RESULT_FILE), { recursive: true });
  writeFileSync(RESULT_FILE, JSON.stringify(out, null, 2));
  return out;
}

export function table(r: S8Result): string {
  const head = "lesson | script s | stored s | A stored (script) | B stored (script) | beats";
  const rows = r.lessons.map(
    (l) => `L${l.lesson} | ${l.script_seconds} | ${l.stored_seconds} | ${l.a_seconds} (${l.a_script_seconds}) | ${l.b_seconds} (${l.b_script_seconds}) | ${l.beats_sent}`,
  );
  return [head, ...rows].join("\n");
}

const REPO_ROOT = resolve(__dirname, "../../../../..");

// One eval_run (suite S8) with one eval_case_result row, written through NL-49's evidence repo.
export async function recordS8Row(r: S8Result): Promise<{ eval_run_id: string; within: boolean; sha: string }> {
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).stdout.trim();
  const pool = new PgDatabase({ database_url: { reveal: () => getStack().databaseUrl } } as never, 2, 5000);
  const repo = new PgEvidenceRepo({ db: pool, ids: new PrefixedIdGenerator(), clock: new SystemClock() });
  const expected = Object.fromEntries(r.lessons.map((l) => [`lesson_${l.lesson}_minutes`, l.script_seconds / 60]));
  const stored = Object.fromEntries(r.lessons.map((l) => [`lesson_${l.lesson}_minutes`, l.stored_seconds / 60]));
  const within = r.lessons.every((l) => Math.abs(l.stored_seconds - l.script_seconds) <= 60);
  const run = await repo.start_eval_run({
    suite: "S8", git_sha: sha, prompt_version_id: null, models: {}, provider_mode: "stub", case_set: "s8-scripted-3-lesson-review", run_id: null,
  });
  await repo.add_case_result({
    eval_run_id: run.eval_run_id, case_id: "s8-3-lesson-review", provenance: "synthetic",
    source: "apps/web/e2e/integration/con-20/script.ts", guards: "scripted +-1 min; two tabs count once; idle tab <= 1 min",
    passed: within, failure_category: within ? null : "heartbeat_accuracy",
    expected, actual: { ...stored, within_one_minute: within, tolerance_minutes: 1 },
  });
  await repo.finish_eval_run(run.eval_run_id, within ? 1 : 0, 1, "apps/web/test-results/con-20/script-result.json");
  return { eval_run_id: run.eval_run_id, within, sha };
}
