import type { components } from "./api-types";

export type Role = components["schemas"]["Role"];

export type Action =
  | "upload_outline" | "start_run" | "edit_lesson" | "insert_quote" | "resolve_issue" | "clear_safety_flag"
  | "submit_lesson" | "withdraw_lesson" | "approve_lesson" | "request_changes" | "reopen_lesson" | "export"
  | "view_prompt_guidance" | "save_prompt_guidance";

export const ROLE_LABEL: Record<Role, string> = { author: "Author", reviewer: "Reviewer", approver: "Approver" };

// IA section 3. Presentation only: the server decides.
const ALLOWED: Record<Action, readonly Role[]> = {
  upload_outline: ["author"],
  start_run: ["author"],
  save_prompt_guidance: ["author"],
  view_prompt_guidance: ["author"],
  edit_lesson: ["reviewer"],
  insert_quote: ["reviewer"],
  submit_lesson: ["reviewer"],
  withdraw_lesson: ["reviewer"],
  resolve_issue: ["reviewer"],
  clear_safety_flag: ["reviewer", "approver"],
  approve_lesson: ["approver"],
  request_changes: ["approver"],
  reopen_lesson: ["approver"],
  export: ["approver"],
};

export function can(role: Role, action: Action): boolean {
  return ALLOWED[action].includes(role);
}
