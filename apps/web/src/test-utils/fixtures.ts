import type { components } from "../lib/api-types";
import type { Role } from "../lib/roles";

// Synthetic. Reviewer and approver mirror the OpenAPI examples; the author is invented in the same shape.
export const SESSIONS: Record<Role, components["schemas"]["Session"]> = {
  author: {
    user: { user_id: "u-aut-1", name: "Author (demo)", email: "author.demo@example.org", role: "author", synthetic: false },
    expires_at: "2026-10-26T03:00:00Z",
  },
  reviewer: {
    user: { user_id: "u-rev-1", name: "Reviewer A (demo)", email: "reviewer.demo@example.org", role: "reviewer", synthetic: false },
    expires_at: "2026-10-26T03:00:00Z",
  },
  approver: {
    user: { user_id: "u-app-1", name: "Approver (demo)", email: "approver.demo@example.org", role: "approver", synthetic: false },
    expires_at: "2026-10-26T03:00:00Z",
  },
};

export const DEMO_PASSWORD = "demo-password-synthetic";
export const COLLAB_COOKIE = { name: "ls_session", value: "mock-session" };
