// NL-101 (S-9): PgSessionRepo.live_hashes answers many session hashes in one query.
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgSessionRepo } from "./sessions.ts";

let t: TestDb;
let repo: PgSessionRepo;
const ids = new PrefixedIdGenerator();
const USER = ids.new_id("usr");
const h = (c: string): string => c.repeat(64);
const NOW = new Date("2026-10-26T09:00:00.000Z");
const plus = (ms: number): Date => new Date(NOW.getTime() + ms);

beforeAll(async () => {
  t = await create_test_db();
  repo = new PgSessionRepo({ db: t.db, ids, clock: new FakeClock(NOW) });
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "app_user", { id: USER, email: "live@example.test", name: "Live", role: "reviewer", synthetic: true, password_hash: "scrypt$x" });
    await repo.create_session(USER, h("a"), plus(3600_000), tx);
    await repo.create_session(USER, h("b"), plus(3600_000), tx);
    await repo.create_session(USER, h("c"), plus(1000), tx);
  });
  await repo.revoke(h("b"), NOW);
});
afterAll(async () => {
  await t.drop();
});

describe("PgSessionRepo.live_hashes", () => {
  it("returns only live sessions: not revoked, not expired, not unknown", async () => {
    const live = await repo.live_hashes([h("a"), h("b"), h("c"), h("d")], plus(2000));
    expect([...live]).toEqual([h("a")]);
  });
  it("[boundary] empty input is empty output", async () => {
    expect((await repo.live_hashes([], NOW)).size).toBe(0);
  });
});
