// NL-101 support (test-writer): seed the WP-1 lesson content under a fresh lesson id, `in_review` unless told otherwise.
// Test data only (synthetic WP-1 fixture). The implementer adds whatever extra rows the SCR-9 page needs (plan 8.2).
import { PgDatabase } from "@ls/db/pool";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Actor } from "@ls/core/ports/common";
import type { StoredLesson } from "@ls/schema/lesson";
import { insert_row } from "@ls/db/testing/insert-row";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { collabSettings } from "./helpers";

export interface SeededLesson {
  lessonId: string;
  unitKey: string;
  lessonKey: string;
  url: string;
}

// Read the WP-1 fixture directly: lesson-docs.test-support uses import.meta, which Playwright's CJS loader rejects.
const SYSTEM_ACTOR: Actor = { user_id: null, name: "system", role: null, synthetic: true };
const wp1 = (): StoredLesson =>
  JSON.parse(readFileSync(resolve(__dirname, "../../../../../packages/ydoc/tests/fixtures/stored-wp1.json"), "utf8")) as StoredLesson;

let pool: PgDatabase | undefined;
const database = (): PgDatabase => (pool ??= new PgDatabase(collabSettings().shared, 4, 5000, "collab"));
export async function closeSeedPool(): Promise<void> {
  await pool?.close();
  pool = undefined;
}

let n = 0;
export async function seedLesson(state: "in_review" | "submitted" | "approved" = "in_review"): Promise<SeededLesson> {
  const ids = new PrefixedIdGenerator();
  const clock = new SystemClock();
  const d = database();
  const deps = { db: d, ids, clock };
  const store = new PgLessonDocStore({ ...deps, checks: new PgCheckQueue(deps), states: new PgLessonRepo(deps), audit: new PgAuditLog(deps) });
  // Unique id per call: unit 1..9, lesson 1..99 (page key patterns g6-u<N> / L<N>).
  n += 1;
  const unit = 1 + (Math.floor(Math.random() * 9) + n) % 9;
  const num = 1 + (Math.floor(Math.random() * 90) + n) % 90;
  const lessonId = `G6.U${unit}.L${num}`;
  await d.with_tx(async (tx) => {
    await insert_row(tx, "lesson", {
      id: lessonId,
      unit_id: `G6.U${unit}`,
      number: num,
      type: "Reading",
      title: "Synthetic WP-1 lesson",
      state,
      schema_version: 1,
      last_editor_id: null,
    });
    await store.seed_initial(lessonId, { ...wp1(), lesson_id: lessonId }, SYSTEM_ACTOR, tx);
  });
  const unitKey = `g6-u${unit}`;
  const lessonKey = `L${num}`;
  return { lessonId, unitKey, lessonKey, url: `/units/${unitKey}/lessons/${lessonKey}` };
}
