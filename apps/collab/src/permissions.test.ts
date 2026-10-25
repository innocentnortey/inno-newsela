// NL-80 frozen tests: AC-2. Failing tests written before the implementation.
import { describe, expect, it } from "vitest";
import { FrozenDocs } from "./frozen-docs.ts";
import { WriteGuard, type SocketContext } from "./permissions.ts";
import { LESSON, user } from "./nl-80.fixtures.ts";
import type { LessonStateName, RoleName } from "@ls/core/ports/common";

const ROLES: RoleName[] = ["author", "reviewer", "approver"];
const STATES: LessonStateName[] = ["draft", "generation_failed", "in_review", "submitted", "changes_requested", "approved", "reopened", "exported"];
const WRITABLE = new Set<string>(["reviewer:in_review", "reviewer:changes_requested", "reviewer:reopened"]);

describe("role_and_state_matrix [invariant, AC-2]", () => {
  it("only a reviewer on an editable state can write (3 roles x 8 states)", () => {
    for (const role of ROLES) {
      for (const state of STATES) {
        const frozen = new FrozenDocs();
        frozen.seed(LESSON, "in_review");
        const d = new WriteGuard(frozen).can_write(role, state, LESSON);
        expect(d.allowed, `${role}/${state}`).toBe(WRITABLE.has(`${role}:${state}`));
        if (!d.allowed) expect(d.refusal).toBe("LESSON_LOCKED");
      }
    }
  });

  it("[invariant] the in_review row: author and approver read, reviewer writes", () => {
    const f = new FrozenDocs();
    f.seed(LESSON, "in_review");
    const guard = new WriteGuard(f);
    expect(guard.can_write("author", "in_review", LESSON).allowed).toBe(false);
    expect(guard.can_write("approver", "in_review", LESSON).allowed).toBe(false);
    expect(guard.can_write("reviewer", "in_review", LESSON).allowed).toBe(true);
  });

  it("[invariant] a frozen document overrides an editable state", () => {
    const f = new FrozenDocs();
    f.seed(LESSON, "in_review");
    f.freeze(LESSON);
    const d = new WriteGuard(f).can_write("reviewer", "in_review", LESSON);
    expect(d).toEqual({ allowed: false, refusal: "LESSON_LOCKED" });
  });

  it("on_update refuses a frozen document or a read-only connection before apply, allows a writable reviewer", () => {
    const guard = new WriteGuard(new FrozenDocs());
    const ctx = (role: RoleName, read_only: boolean): SocketContext =>
      ({ socket_id: "s", user: user(role), lesson_id: LESSON, lesson_state: "in_review", read_only }) as SocketContext;
    expect(guard.on_update(ctx("reviewer", false), false)).toEqual({ allowed: true, refusal: null });
    expect(guard.on_update(ctx("reviewer", false), true)).toEqual({ allowed: false, refusal: "LESSON_LOCKED" });
    expect(guard.on_update(ctx("author", true), false)).toEqual({ allowed: false, refusal: "LESSON_LOCKED" });
    expect(guard.on_update(ctx("approver", true), true).allowed).toBe(false);
  });
});
