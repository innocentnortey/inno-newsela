// The typed lock_and_snapshot export only refuses until NL-106 replaces its body.
import { describe, expect, it } from "vitest";
import { lock_and_snapshot } from "./lock-and-snapshot.ts";
import { submit_body } from "./nl-105.fixtures.ts";

describe("lock_and_snapshot typed export", () => {
  it("refuses_with_collab_unavailable_until_nl106", async () => {
    await expect(lock_and_snapshot({} as never, submit_body() as never)).rejects.toMatchObject({ code: "COLLAB_UNAVAILABLE" });
  });
});
