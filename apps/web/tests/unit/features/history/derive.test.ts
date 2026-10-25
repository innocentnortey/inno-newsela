import { describe, expect, it } from "vitest";
import {
  auditFor,
  auditLine,
  provenanceRows,
  selectedVersion,
  transitionFor,
  type AuditRow,
  type VersionEntry,
} from "@/features/history/derive";
import { hash, version } from "./fixtures";

const vs0 = [
  version({ version_number: 1 }),
  version({ version_number: 2, kind: "candidate" }),
  version({ version_number: 3, kind: "submit" }),
];
const vs = vs0 as [VersionEntry, VersionEntry, VersionEntry];
const audit0: AuditRow[] = [
  {
    at: "2026-10-25T10:42:00Z",
    user: "J. Rivera",
    action: "clear_safety_flag",
    from_state: "in_review",
    to_state: "in_review",
    version_hash: hash(1),
    reason: "Image alt text checked",
  },
  {
    at: "2026-10-25T11:00:00Z",
    user: "A",
    action: "submit",
    from_state: "in_review",
    to_state: "submitted",
    version_hash: hash(3),
    reason: null,
  },
];
const audit = audit0 as [AuditRow, AuditRow];

describe("selectedVersion", () => {
  it("picks the match, else the highest", () => {
    expect(selectedVersion(vs, "2")?.version_number).toBe(2);
    expect(selectedVersion(vs, "abc")?.version_number).toBe(3);
    expect(selectedVersion(vs, "99")?.version_number).toBe(3);
    expect(selectedVersion(vs, null)?.version_number).toBe(3);
    expect(selectedVersion([], "1")).toBeNull();
  });
});

describe("audit helpers", () => {
  it("filters by hash and finds the transition", () => {
    expect(auditFor(audit0, vs[0])).toHaveLength(1);
    expect(transitionFor(audit0, vs[2])).toEqual({
      from_state: "in_review",
      to_state: "submitted",
      reason: null,
    });
    expect(transitionFor(audit0, vs[0])).toBeNull();
  });
  it("finds the transition in the real audit view's lesson.transition rows by to_state (NL-100)", () => {
    const real: AuditRow[] = [
      { at: "2026-10-25T11:00:00Z", user: "A", action: "lesson.transition", from_state: "in_review", to_state: "submitted", version_hash: hash(3), reason: "Ready" },
      { at: "2026-10-25T12:00:00Z", user: "B", action: "lesson.transition", from_state: "submitted", to_state: "approved", version_hash: hash(3), reason: "OK" },
    ];
    expect(transitionFor(real, vs[2])).toEqual({ from_state: "in_review", to_state: "submitted", reason: "Ready" });
    expect(transitionFor(real, { ...vs[2], kind: "approval" })).toEqual({ from_state: "submitted", to_state: "approved", reason: "OK" });
    expect(transitionFor(real, { ...vs[2], kind: "reopen" })).toBeNull();
  });
  it("formats the audit line", () => {
    expect(auditLine(audit[0])).toBe(
      "Safety flag cleared by J. Rivera: Image alt text checked · 10:42",
    );
  });
});

describe("provenanceRows", () => {
  it("keeps a fixed order and states", () => {
    const rows = provenanceRows(vs[0]);
    expect(rows.map((r) => r.key)).toEqual([
      "outline_row_hash",
      "prompt_version_id",
      "model",
      "schema_version",
      "example_set_id",
      "run_id",
      "cost_usd",
    ]);
    expect(rows.every((r) => r.state === "present")).toBe(true);
    const cand = version({
      version_number: 2,
      kind: "candidate",
      provenance: { ...vs[0].provenance, example_set_id: null },
    });
    expect(
      provenanceRows(cand).find((r) => r.key === "example_set_id")?.state,
    ).toBe("na");
    const gen = version({
      version_number: 1,
      provenance: { ...vs[0].provenance, run_id: null, schema_version: 0 },
    });
    const r = provenanceRows(gen);
    expect(r.find((x) => x.key === "run_id")?.state).toBe("missing");
    expect(r.find((x) => x.key === "schema_version")?.state).toBe("present");
  });
});
