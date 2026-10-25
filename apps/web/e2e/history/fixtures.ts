// Synthetic, traceable to WP-1 Lesson 4 (G6.U4.L4) and the OpenAPI `lesson4` example.
import type { components } from "../../src/lib/api-types";

export type LessonHistory = components["schemas"]["LessonHistory"];
type VersionEntry = components["schemas"]["VersionEntry"];
type AuditRow = components["schemas"]["AuditRow"];

export const HASH = (n: number) =>
  n.toString(16).padStart(4, "0") + "0".repeat(60);

const base = {
  outline_row_hash: HASH(900),
  prompt_version_id: "pv-0007",
  schema_version: 3,
  run_id: "run-0001",
};

function v(
  n: number,
  kind: VersionEntry["kind"],
  at: string,
  by: string,
  provenance: VersionEntry["provenance"],
  adopted: boolean | null = null,
): VersionEntry {
  return {
    version_id: `lv-4-${n}`,
    version_number: n,
    kind,
    content_hash: HASH(n),
    created_at: at,
    created_by: by,
    adopted,
    provenance,
  };
}

export function history4(): LessonHistory {
  const human = {
    ...base,
    model: null,
    parameters: null,
    example_set_id: null,
    cost_usd: 0,
    derived_from_version_id: "lv-4-1",
  };
  const audit = (
    n: number,
    at: string,
    user: string,
    action: string,
    from: AuditRow["from_state"],
    to: AuditRow["to_state"],
    reason: string | null = null,
  ): AuditRow => ({
    at,
    user,
    action,
    from_state: from,
    to_state: to,
    version_hash: HASH(n),
    reason,
  });
  return {
    versions: [
      v(1, "generated", "2026-10-25T09:00:00Z", "worker", {
        ...base,
        model: "generation-model (ID confirmed at build time)",
        parameters: null,
        example_set_id: "ex-0001",
        cost_usd: 0.52,
        derived_from_version_id: null,
      }),
      v(
        2,
        "candidate",
        "2026-10-25T09:30:00Z",
        "Reviewer A (demo)",
        {
          ...base,
          run_id: "run-0002",
          model: "generation-model (ID confirmed at build time)",
          parameters: null,
          example_set_id: null,
          cost_usd: 0.31,
          derived_from_version_id: "lv-4-1",
        },
        false,
      ),
      v(3, "submit", "2026-10-25T11:00:00Z", "Reviewer A (demo)", human),
      v(4, "approval", "2026-10-25T12:00:00Z", "Approver (demo)", human),
      v(5, "reopen", "2026-10-25T13:00:00Z", "Approver (demo)", human),
    ],
    audit: [
      audit(
        1,
        "2026-10-25T09:10:00Z",
        "Reviewer A (demo)",
        "start_review",
        "draft",
        "in_review",
      ),
      audit(
        1,
        "2026-10-25T10:42:00Z",
        "J. Rivera",
        "clear_safety_flag",
        "in_review",
        "in_review",
        "Image alt text checked",
      ),
      audit(
        3,
        "2026-10-25T11:00:00Z",
        "Reviewer A (demo)",
        "submit",
        "in_review",
        "submitted",
      ),
      audit(
        4,
        "2026-10-25T12:00:00Z",
        "Approver (demo)",
        "approve",
        "submitted",
        "approved",
      ),
      audit(
        5,
        "2026-10-25T13:00:00Z",
        "Approver (demo)",
        "reopen",
        "approved",
        "reopened",
        "Typo in Homework",
      ),
    ],
    ai_spans: [],
  };
}

export function historyMissingField(): LessonHistory {
  const h = history4();
  delete (h.versions[2]!.provenance as unknown as Record<string, unknown>)
    .prompt_version_id;
  return h;
}
