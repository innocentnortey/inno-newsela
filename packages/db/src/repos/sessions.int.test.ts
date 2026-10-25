// NL-25 AC-9 (invariant): PgSessionRepo.resolve is the single read path (web and collab agree). Frozen.
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insert_row } from "../testing/insert-row.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { PgSessionRepo } from "./sessions.ts";

let t: TestDb;
let repo: PgSessionRepo;
let clock: FakeClock;
const ids = new PrefixedIdGenerator();
const USER = ids.new_id("usr");
const h = (c: string): string => c.repeat(64);
const NOW = new Date("2026-10-26T09:00:00.000Z");
const plus = (ms: number): Date => new Date(NOW.getTime() + ms);

beforeAll(async () => {
  t = await create_test_db();
  clock = new FakeClock(NOW);
  repo = new PgSessionRepo({ db: t.db, ids, clock });
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "app_user", { id: USER, email: "Reviewer.Demo@Example.test", name: "Demo reviewer", role: "reviewer", synthetic: true, password_hash: "scrypt$x" });
  });
});
afterAll(async () => {
  await t.drop();
});

describe("PgSessionRepo (AC-9)", () => {
  it("resolve_live: returns user and session for a live token", async () => {
    const row = await t.db.with_tx((tx) => repo.create_session(USER, h("a"), plus(12 * 3600_000), tx));
    expect(row.token_hash).toBe(h("a"));
    expect(row.user_id).toBe(USER);
    const ctx = await repo.resolve(h("a"), NOW);
    expect(ctx?.user).toEqual({ user_id: USER, email: "Reviewer.Demo@Example.test", name: "Demo reviewer", role: "reviewer", synthetic: true });
    expect(ctx?.session.token_hash).toBe(h("a"));
    expect(ctx?.session.expires_at.toISOString()).toBe(plus(12 * 3600_000).toISOString());
  });
  it("resolve_expired: null at and after expires_at (expires_at <= now)", async () => {
    await t.db.with_tx((tx) => repo.create_session(USER, h("b"), plus(1000), tx));
    expect(await repo.resolve(h("b"), plus(999))).not.toBeNull();
    expect(await repo.resolve(h("b"), plus(1000))).toBeNull();
    expect(await repo.resolve(h("b"), plus(5000))).toBeNull();
  });
  it("resolve_revoked: null once revoked; revoke is idempotent", async () => {
    await t.db.with_tx((tx) => repo.create_session(USER, h("c"), plus(3600_000), tx));
    expect(await repo.resolve(h("c"), NOW)).not.toBeNull();
    await repo.revoke(h("c"), plus(10));
    await repo.revoke(h("c"), plus(20));
    expect(await repo.resolve(h("c"), NOW)).toBeNull();
    const r = await t.db.with_tx(async (tx) => (await tx.query("SELECT revoked_at FROM app_session WHERE token_hash=$1", [h("c")])).rows[0]);
    expect((r?.["revoked_at"] as Date).toISOString()).toBe(plus(10).toISOString());
  });
  it("boundary: unknown token resolves to null; find_user_by_email is case-insensitive and null when absent", async () => {
    expect(await repo.resolve(h("f"), NOW)).toBeNull();
    const found = await repo.find_user_by_email("reviewer.demo@example.test");
    expect(found?.user.user_id).toBe(USER);
    expect(found?.password_hash).toBe("scrypt$x");
    expect(await repo.find_user_by_email("nobody@example.test")).toBeNull();
  });
});
