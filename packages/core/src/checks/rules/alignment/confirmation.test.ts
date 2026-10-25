import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "../../test-helpers.ts";
import { RULE_GROUPS, run_checks } from "../../registry.ts";
import { lesson_with, rec, wp1_ctx } from "./test-support.ts";

const counts = (ctx: ReturnType<typeof wp1_ctx>) => {
  const r = run_checks(ctx, RULE_GROUPS.alignment, DEFAULT_POLICY);
  return { blocking: r.blocking, confirmation: r.confirmation };
};

describe("standard_confirmation", () => {
  it("a narrowed leaf needs one confirmation, and a named confirmer clears it", () => {
    const ctx = wp1_ctx({ lesson: lesson_with([rec("L.6.4.b", { origin: "narrowed" })]) });
    expect(counts(ctx)).toEqual({ blocking: 0, confirmation: 1 });
    const done = {
      ...ctx,
      confirmations: [
        { lesson_id: ctx.lesson_id, content_hash: ctx.content_hash, code: "L.6.4.b", address: "x", role: "I" as const, origin: "narrowed" as const, asserted_by: "reviewer" as const, confirmed_by: "u1" },
      ],
    };
    expect(counts(done)).toEqual({ blocking: 0, confirmation: 0 });
  });

  it("an added code (row list empty) needs one confirmation", () => {
    const base = wp1_ctx({ lesson: lesson_with([rec("RL.6.7", { origin: "added" })], "RL.6.7"), allowed_codes: [] });
    const ctx = { ...base, row: { ...base.row, focus_codes: [] } };
    expect(counts(ctx)).toEqual({ blocking: 0, confirmation: 1 });
  });
});
