// evaluate_submit_gate: the gate order and the resolution carry-over, with the controlled stubs (no database).
import { describe, expect, it } from "vitest";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import type { StoredLesson } from "@ls/schema/lesson";
import { evaluate_submit_gate } from "./submit-gate.ts";
import { Controls, loader_for, rules_for } from "./nl-106.fixtures.ts";

const stored = { lesson: {} as StoredLesson, content_hash: "a".repeat(64) };
const waiting_dep = { direction: "waits_on", lesson_id: "G6.U4.L5", slot_id: "s1", source_state: "draft", slot_filled: true, source_approved_hash: null };
function run(c: Controls, resolutions: unknown[] = [], dependencies: unknown[] = [], rules = rules_for(c)) {
  const deps = { loader: loader_for(c), rules, policy: CHECK_POLICY, issues: { resolutions_for: async () => resolutions }, graph: { dependencies: async () => dependencies } } as never;
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
  // R-F3-7: the waiting phase (slot filled, source not approved) passes Submit; an unfilled slot or another lesson still blocks.
  const link_rule = (related: string) => [{
    kind: "cross_lesson_link" as const, level: "blocking" as const,
    run: () => [{ kind: "cross_lesson_link" as const, level: "blocking" as const, message: "Waiting", address: "launch", span_anchor: null, related_lesson_id: related, code: null }],
  }] as never;
  it("cross_lesson_link in the waiting phase passes Submit", async () => {
    expect(await run(new Controls(), [], [waiting_dep], link_rule("G6.U4.L5"))).toBe("ALLOWED");
  });
  it("cross_lesson_link blocks Submit when the slot is not filled or the dependency is another lesson", async () => {
    expect(await run(new Controls(), [], [{ ...waiting_dep, slot_filled: false }], link_rule("G6.U4.L5"))).toMatchObject({ code: "BLOCKED" });
    expect(await run(new Controls(), [], [waiting_dep], link_rule("G6.U4.L9"))).toMatchObject({ code: "BLOCKED" });
    expect(await run(new Controls(), [], [], link_rule("G6.U4.L5"))).toMatchObject({ code: "BLOCKED" });
  });
});
