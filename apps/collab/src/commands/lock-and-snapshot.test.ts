// Unit cases for the lock_and_snapshot entry (the database cases are in lock-and-snapshot.int.test.ts).
import { describe, expect, it } from "vitest";
import { FrozenDocs } from "../frozen-docs.ts";
import { lock_and_snapshot } from "./lock-and-snapshot.ts";
import { submit_body } from "./nl-105.fixtures.ts";

function deps(state: string | null, frozen: FrozenDocs) {
  return { states: { get: async () => (state === null ? null : { state }) }, frozen, logger: { info() {}, warn() {} } } as never;
}

describe("lock_and_snapshot entry", () => {
  it("refuses an unknown lesson with NOT_FOUND", async () => {
    await expect(lock_and_snapshot(deps(null, new FrozenDocs()), submit_body() as never)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses an already frozen lesson with LESSON_LOCKED and does not unfreeze it", async () => {
    const frozen = new FrozenDocs();
    const cmd = submit_body() as unknown as { lesson_id: string };
    frozen.seed(cmd.lesson_id, "in_review");
    frozen.freeze(cmd.lesson_id);
    await expect(lock_and_snapshot(deps("in_review", frozen), cmd as never)).rejects.toMatchObject({ code: "LESSON_LOCKED" });
    expect(frozen.is_frozen(cmd.lesson_id)).toBe(true);
  });
});
