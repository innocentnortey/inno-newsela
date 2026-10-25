import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DRAFT_ROLES } from "@ls/schema/lesson-draft";
import { LOCKED_DIR, locked_hash } from "./locked.ts";
import { copy_locked_dir } from "./testing/fixtures.ts";

describe("contents_and_hash", () => {
  const files = readdirSync(LOCKED_DIR).sort();
  it("has exactly the nine locked files, clean of fences and keys", () => {
    expect(files).toEqual(
      ["assist.md", "content-rules.md", "data-delimiters.md", "grounding-rules.md", "judge.md", "lesson-draft.md", "lesson-shape.md", "repair.md", "unit-plan.md"],
    );
    for (const f of files) {
      const t = readFileSync(join(LOCKED_DIR, f), "utf8");
      expect(t).not.toContain("```");
      expect(t).not.toContain("sk-");
      expect(t).not.toContain("OUTLINE_DATA>>>");
    }
  });
  it("lists all roles and grounding escape hatches", () => {
    const shape = readFileSync(join(LOCKED_DIR, "lesson-shape.md"), "utf8");
    for (const role of DRAFT_ROLES) expect(shape).toContain(role);
    const g = readFileSync(join(LOCKED_DIR, "grounding-rules.md"), "utf8");
    expect(g).toContain("text_evidence_needed");
    expect(g).toContain("excerpt_slot");
  });
  it("a one-byte edit of any file changes the hash", () => {
    const base = locked_hash(LOCKED_DIR);
    const seen = new Set([base]);
    for (const f of files) {
      const dir = copy_locked_dir();
      appendFileSync(join(dir, f), "x");
      const h = locked_hash(dir);
      expect(seen.has(h), f).toBe(false);
      seen.add(h);
    }
  });
});
