// Guard: a finding's `matched` text (the name or page reference that tripped a grounding check) is in-memory only.
// The issue table has no column for it, and PgIssueRepo must never read it when writing issue rows.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PgIssueRepo ignores finding.matched", () => {
  it("issue_repo_never_reads_matched", () => {
    const src = readFileSync(new URL("./issue-repo.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/\bmatched\b/);
  });
  it("issue_table_has_no_matched_column", () => {
    const dir = new URL("../../migrations/", import.meta.url);
    const found = readdirSync(dir).some((f) => /\bmatched\b/.test(readFileSync(new URL(f, dir), "utf8")));
    expect(found).toBe(false);
  });
});
