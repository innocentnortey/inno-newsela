// NL-47
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { LessonId, RunId } from "@ls/core/ports/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { seed_job, seed_run } from "../testing/seed-run.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgCandidateLookup } from "./candidate-lookup.ts";

let t: TestDb;
let lk: PgCandidateLookup;
const L4 = "G6.U4.L4" as LessonId;
const L5 = "G6.U4.L5" as LessonId;
const w = <T>(fn: (tx: import("../tx.ts").Tx) => Promise<T>): Promise<T> =>
  t.db.with_tx(fn);

beforeAll(async () => {
  t = await create_test_db();
  lk = new PgCandidateLookup({
    db: t.db,
    ids: new PrefixedIdGenerator(),
    clock: new FakeClock(new Date("2026-10-01T10:00:00Z")),
  });
});
afterAll(async () => {
  await t.drop();
});

describe("PgCandidateLookup", () => {
  it("in_flight_run returns the run of a queued candidate job, null once ready", async () => {
    const r = await w((tx) => seed_run(tx));
    const j = await w((tx) =>
      seed_job(tx, {
        run_id: r,
        kind: "candidate",
        status: "queued",
        lesson_id: L4,
      }),
    );
    expect(await lk.in_flight_run(L4)).toBe(r);
    expect(await lk.in_flight_run(L5)).toBeNull();
    await w((tx) =>
      tx.query("UPDATE lesson_job SET status='ready' WHERE id=$1", [j]),
    );
    expect(await lk.in_flight_run(L4)).toBeNull();
  });

  it("latest_lesson_run ignores candidate jobs and returns the newest lesson job", async () => {
    const old = await w((tx) => seed_run(tx));
    const newer = await w((tx) => seed_run(tx));
    const cand = await w((tx) => seed_run(tx));
    await w((tx) =>
      seed_job(tx, {
        run_id: old,
        kind: "lesson",
        status: "ready",
        lesson_id: L5,
        queued_at: new Date("2026-10-01T10:00:00Z"),
      }),
    );
    await w((tx) =>
      seed_job(tx, {
        run_id: newer,
        kind: "lesson",
        status: "ready",
        lesson_id: L5,
        queued_at: new Date("2026-10-01T11:00:00Z"),
      }),
    );
    await w((tx) =>
      seed_job(tx, {
        run_id: cand,
        kind: "candidate",
        status: "ready",
        lesson_id: L5,
        queued_at: new Date("2026-10-01T12:00:00Z"),
      }),
    );
    expect(await lk.latest_lesson_run(L5)).toBe(newer);
    expect(await lk.latest_lesson_run("G6.U4.L9" as LessonId)).toBeNull();
  });

  it("version_of_run returns the candidate version a run wrote, null for another run; next_version_number is max+1", async () => {
    const L = "G6.U4.L6" as LessonId;
    expect(await lk.next_version_number(L)).toBe(1);
    await w(async (tx) => {
      await insert_row(tx, "lesson_version", {
        id: "ver_gen",
        lesson_id: L,
        number: 1,
        kind: "generated",
        run_id: "run_gen",
      });
      await insert_row(tx, "lesson_version", {
        id: "ver_cand",
        lesson_id: L,
        number: 2,
        kind: "candidate",
        run_id: "run_cand",
      });
    });
    expect(await lk.version_of_run(L, "run_cand" as RunId)).toBe("ver_cand");
    expect(await lk.version_of_run(L, "run_gen" as RunId)).toBeNull(); // generated, not a candidate
    expect(await lk.version_of_run(L, "run_other" as RunId)).toBeNull();
    expect(await lk.next_version_number(L)).toBe(3);
  });
});
