import { describe, expect, it } from "vitest";
import { can, ROLE_LABEL, type Action, type Role } from "@/lib/roles";

describe("roles", () => {
  it("labels", () => expect(ROLE_LABEL).toEqual({ author: "Author", reviewer: "Reviewer", approver: "Approver" }));
  const table: Record<Action, Role[]> = {
    upload_outline: ["author"], start_run: ["author"], save_prompt_guidance: ["author"], view_prompt_guidance: ["author"],
    edit_lesson: ["reviewer"], insert_quote: ["reviewer"], submit_lesson: ["reviewer"], withdraw_lesson: ["reviewer"],
    resolve_issue: ["reviewer"], clear_safety_flag: ["reviewer", "approver"],
    approve_lesson: ["approver"], request_changes: ["approver"], reopen_lesson: ["approver"], export: ["approver"],
  };
  for (const [action, roles] of Object.entries(table) as Array<[Action, Role[]]>) {
    it(`${action} is allowed for ${roles.join(", ")} only`, () => {
      for (const r of ["author", "reviewer", "approver"] as Role[]) expect(can(r, action)).toBe(roles.includes(r));
    });
  }
});
