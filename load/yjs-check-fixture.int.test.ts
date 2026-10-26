// NL-127 follow-up F-B1: the Yjs load lessons must pass the real CheckContextLoader, so a worker check
// on a load lesson no longer throws InvariantViolation (no_outline_version) on every retry.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import { PgAlignmentRepo, PgSafetyFlagRepo, PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { seed_load_lessons } from "./yjs-support.ts";

const ids = new PrefixedIdGenerator();
const clock = new SystemClock();
let t: TestDb;

beforeAll(async () => {
  t = await create_test_db({ pool_max: 4 });
}, 90000);
afterAll(async () => {
  await t.drop();
});

describe("load lessons pass the check context loader (F-B1)", () => {
  it("seeded load lessons load without InvariantViolation, and seeding twice is harmless", async () => {
    // The real stack has the standards seeded (ops/seed.ts); a bare test database does not, and the loader refuses an empty table.
    await t.db.with_tx(async (tx) => {
      await insert_row(tx as never, "standard", { code: "RL.6.1", set: "CA_CCSS_ELA_6", text: "Synthetic standard text", parent_code: null, is_leaf: true, eld_strand: null });
    });
    const support = { db: t.db, ids, clock };
    const lesson_ids = await seed_load_lessons(support, 2);
    await seed_load_lessons(support, 2);
    const rd = support;
    const reader = new PgLessonDocReader({ db: t.db });
    const alignment = new PgAlignmentRepo(rd);
    const loader = new CheckContextLoader(
      new PgOutlineRepo(rd), new PgStandardRepo(rd), new PgLessonRepo(rd), reader,
      new PgSuggestionRepo(rd), new PgSafetyFlagRepo(rd), alignment, clock,
    );
    for (const id of lesson_ids) {
      const derived = await reader.latest_derived(id as never);
      expect(derived).not.toBeNull();
      await expect(loader.load(id as never, derived!.lesson, derived!.content_hash as never)).resolves.toBeDefined();
    }
  });
});
