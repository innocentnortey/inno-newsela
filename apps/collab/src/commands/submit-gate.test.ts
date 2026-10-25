// evaluate_submit_gate: the gate order and the resolution carry-over, with the controlled stubs (no database).
import { describe, expect, it } from "vitest";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import type { StoredLesson } from "@ls/schema/lesson";
import { evaluate_submit_gate } from "./submit-gate.ts";
import { Controls, loader_for, rules_for } from "./nl-106.fixtures.ts";

const stored = { lesson: {} as StoredLesson, content_hash: "a".repeat(64) };
function run(c: Controls, resolutions: unknown[] = []) {
  const deps = { loader: loader_for(c), rules: rules_for(c), policy: CHECK_POLICY, issues: { resolutions_for: async () => resolutions } } as never;
  return evaluate_submit_gate(deps, "G6.U4.L1", stored).then(() => "ALLOWED", (e: any) => ({ code: e.code, details: e.details }));
}

describe("evaluate_submit_gate", () => {
  it("passes a clean lesson", async () => {
    expect(await run(new Controls())).toBe("ALLOWED");
  });
  it("SUGGESTION_PENDING comes first, even with blocking and confirmation findings", async () => {
    const c = new Controls();
    c.pending = 1; c.blocking = true; c.confirmation = true;
    expect(await run(c)).toMatchObject({ code: "SUGGESTION_PENDING" });
  });
  it("BLOCKED lists blocking and confirmation issues together", async () => {
    const c = new Controls();
    c.blocking = true; c.confirmation = true;
    const r: any = await run(c);
    expect(r.code).toBe("BLOCKED");
    const s = JSON.stringify(r.details);
    expect(s).toContain("quote_placeholder_open");
    expect(s).toContain("standard_confirmation");
  });
  it("CONFIRMATION_OPEN alone", async () => {
    const c = new Controls();
    c.confirmation = true;
    expect(await run(c)).toMatchObject({ code: "CONFIRMATION_OPEN" });
  });
  it("safety_flag_open still blocks", async () => {
    const c = new Controls();
    c.safety = true;
    expect(await run(c)).toMatchObject({ code: "BLOCKED" });
  });
});
