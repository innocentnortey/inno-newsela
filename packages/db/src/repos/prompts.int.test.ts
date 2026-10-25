// NL-34 AC-1, AC-2, AC-6, AC-7, AC-8 against a real database.
import { afterAll, describe, expect, it } from "vitest";
import { DomainRefusal } from "@ls/core/errors";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { UserId } from "@ls/core/ports/common";
import { PgPromptRepo } from "./prompts.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";
import { insert_row } from "../testing/insert-row.ts";

let t: TestDb;
let repo: PgPromptRepo;
const made: TestDb[] = [];
const A = "a".repeat(64);
const B = "b".repeat(64);
const AUTHOR = "usr_synthetic_author" as UserId;

// Triggers forbid delete and truncate, so each test works in a fresh database.
async function fresh() {
  t = await create_test_db();
  made.push(t);
  repo = new PgPromptRepo({
    db: t.db,
    ids: new PrefixedIdGenerator(),
    clock: { now: () => new Date(), sleep: async () => {} },
  });
}
afterAll(async () => {
  for (const d of made) await d.drop();
});
const sync = (h: string) => t.db.with_tx((tx) => repo.sync_locked_layer(h, tx));
const count = async () =>
  t.db.with_tx(async (tx) => Number((await tx.query<{ n: string }>("select count(*) n from prompt_version")).rows[0]!.n));
const save = (base: string, text: string) =>
  t.db.with_tx((tx) =>
    repo.insert_guidance({ base_version_id: base, guidance_text: text, reason: "r", author_id: AUTHOR }, "+" + text, tx),
  );

describe("PgPromptRepo (NL-34)", () => {
  it("sync_creates_v1_once", async () => {
    await fresh();
    const h = "c".repeat(64); // the real-hash equality is asserted in wiring/prompts.test.ts (db may not import @ls/prompts)
    const first = await sync(h);
    expect(first).toMatchObject({ number: 1, locked_hash: h, guidance_text: "", reason: "initial", author_id: null });
    expect(await sync(h)).toBeNull();
    expect(await count()).toBe(1);
    await fresh();
    await Promise.all([sync(h), sync(h)]);
    expect(await count()).toBe(1);
  });

  it("sync_new_locked_hash_new_version", async () => {
    await fresh();
    const v1 = (await sync(A))!;
    const v2 = await save(v1.prompt_version_id, "g");
    const snapshot = async () =>
      t.db.with_tx(async (tx) => (await tx.query("select to_jsonb(p.*) j from prompt_version p order by number")).rows);
    const before = await snapshot();
    const v3 = (await sync(B))!;
    expect(v3).toMatchObject({ number: 3, locked_hash: B, guidance_text: "g" });
    expect((await snapshot()).slice(0, 2)).toEqual(before);
    expect(v2.number).toBe(2);
    expect(await sync(B)).toBeNull();
    expect(await count()).toBe(3);
  });

  describe("immutable_and_stale_base", () => {
    it("update, delete and truncate are refused", async () => {
      await fresh();
      await sync(A);
      for (const sql of ["update prompt_version set guidance_text='x'", "delete from prompt_version"]) {
        await expect(t.db.with_tx((tx) => tx.query(sql))).rejects.toThrow(/append-only: prompt_version/);
      }
      await expect(t.db.with_tx((tx) => tx.query("truncate prompt_version"))).rejects.toThrow(/append-only: prompt_version/);
      expect(await count()).toBe(1);
      const names = Object.getOwnPropertyNames(PgPromptRepo.prototype);
      expect(names.filter((n) => /^(update|delete|set|remove)/.test(n))).toEqual([]);
    });

    it("a stale base is refused with the latest id", async () => {
      await fresh();
      const v1 = (await sync(A))!;
      const v2 = await save(v1.prompt_version_id, "one");
      const err = await save(v1.prompt_version_id, "two").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(DomainRefusal);
      expect((err as DomainRefusal).code).toBe("STALE_BASE");
      expect((err as DomainRefusal).details).toEqual({ latest_version_id: v2.prompt_version_id });
      expect(await count()).toBe(2);
    });

    it("the current base inserts number+1 with the same locked hash", async () => {
      await fresh();
      const v1 = (await sync(A))!;
      const v2 = await save(v1.prompt_version_id, "one");
      expect(v2).toMatchObject({ number: 2, locked_hash: A, guidance_text: "one", author_id: AUTHOR, diff: "+one" });
    });
  });

  it("concurrent_saves_one_wins", async () => {
    await fresh();
    const v1 = (await sync(A))!;
    const r = await Promise.allSettled([save(v1.prompt_version_id, "x"), save(v1.prompt_version_id, "y")]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const lost = r.find((x) => x.status === "rejected") as PromiseRejectedResult;
    expect(lost.reason).toBeInstanceOf(DomainRefusal);
    expect((lost.reason as DomainRefusal).code).toBe("STALE_BASE");
    expect(await count()).toBe(2);
  });

  describe("current_get_all_pin", () => {
    it("get, current and all", async () => {
      await fresh();
      const v1 = (await sync(A))!;
      expect(await repo.get("unknown")).toBeNull();
      const v2 = await save(v1.prompt_version_id, "g");
      expect((await repo.current()).prompt_version_id).toBe(v2.prompt_version_id);
      expect((await repo.all()).map((r) => r.number)).toEqual([1, 2]);
    });

    it("pinned_by_runs lists runs on the version they used", async () => {
      await fresh();
      const v1 = (await sync(A))!;
      await t.db.with_tx((tx) => insert_row(tx, "run", { id: "run_synthetic_1", prompt_version_id: v1.prompt_version_id }));
      const v2 = await save(v1.prompt_version_id, "g");
      expect((await repo.get(v1.prompt_version_id))?.number).toBe(1);
      expect(await repo.pinned_by_runs(v1.prompt_version_id)).toEqual(["run_synthetic_1"]);
      expect(await repo.pinned_by_runs(v2.prompt_version_id)).toEqual([]);
    });

    it("author_names maps ids to names", async () => {
      await fresh();
      await t.db.with_tx((tx) => insert_row(tx, "app_user", { id: AUTHOR, name: "Test author", role: "author", synthetic: true }));
      expect((await repo.author_names([AUTHOR, "usr_missing"])).get(AUTHOR)).toBe("Test author");
      expect((await repo.author_names([])).size).toBe(0);
    });
  });
});
