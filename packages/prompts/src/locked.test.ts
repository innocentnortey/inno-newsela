// NL-14 FROZEN (AC-5). Do not edit.
import { describe, expect, it } from "vitest";
import { LOCKED_DIR, LockedLayerMismatch, locked_hash } from "./locked.ts";
import { PromptRenderer } from "./render.ts";
import { SchemaRegistry } from "./schemas.ts";
import {
  append_byte,
  assist_input,
  copy_locked_dir,
  draft_input,
  judge_input,
  repair_input,
  unit_plan_input,
  wp2_row,
} from "./testing/fixtures.ts";

const ZEROS = "0".repeat(64);

type Run = [string, (r: PromptRenderer, hash: string) => unknown];
const runs: Run[] = [
  ["render_unit_plan", (r, h) => r.render_unit_plan(unit_plan_input(wp2_row(), "", h))],
  ["render_lesson_draft", (r, h) => r.render_lesson_draft(draft_input(wp2_row(), "", h))],
  ["render_repair", (r, h) => r.render_repair(repair_input(h))],
  ["render_assist", (r, h) => r.render_assist(assist_input("text", "", h))],
  ["render_judge", (r, h) => r.render_judge(judge_input(h))],
];

describe("locked layer mismatch (AC-5, failure/refusal, R-38)", () => {
  it("a PromptVersionRow whose locked_hash differs from disk makes every render_* throw LockedLayerMismatch", () => {
    const renderer = new PromptRenderer(LOCKED_DIR, new SchemaRegistry());
    const actual = locked_hash(LOCKED_DIR);
    expect(actual).toMatch(/^[0-9a-f]{64}$/);
    for (const [name, run] of runs) {
      let returned: unknown = "not-called";
      let err: unknown;
      try {
        returned = run(renderer, ZEROS);
      } catch (e) {
        err = e;
      }
      expect(err, name).toBeInstanceOf(LockedLayerMismatch);
      expect((err as LockedLayerMismatch).expected).toBe(ZEROS);
      expect((err as LockedLayerMismatch).actual).toBe(actual);
      expect(returned, name).toBe("not-called");
    }
  });

  it("a one-byte edit of a locked file makes every render_* throw LockedLayerMismatch", () => {
    const pinned = locked_hash(LOCKED_DIR);
    const dir = copy_locked_dir();
    expect(locked_hash(dir)).toBe(pinned);
    append_byte(dir, "content-rules.md");
    const edited = locked_hash(dir);
    expect(edited).not.toBe(pinned);
    const renderer = new PromptRenderer(dir, new SchemaRegistry());
    for (const [name, run] of runs) {
      let returned: unknown = "not-called";
      let err: unknown;
      try {
        returned = run(renderer, pinned);
      } catch (e) {
        err = e;
      }
      expect(err, name).toBeInstanceOf(LockedLayerMismatch);
      expect((err as LockedLayerMismatch).expected).toBe(pinned);
      expect((err as LockedLayerMismatch).actual).toBe(edited);
      expect(returned, name).toBe("not-called");
    }
  });
});
