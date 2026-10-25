import { describe, expect, it } from "vitest";
import { formatPromptLine } from "@/features/start-run/prompt-line";
import type { components } from "@/lib/api-types";

type P = components["schemas"]["PromptVersions"];
const g = (number: number) => ({ version_id: `guidance-${number}`, number, author: "Author (demo)", created_at: "2026-10-25T14:00:00Z", reason: "r", diff: "", pinned_by_runs: [] });
const make = (id: string, nums: number[]): P => ({ current_prompt_version_id: "pv", locked_layer: { version_id: id, text: "x" }, guidance_versions: nums.map(g) });

describe("formatPromptLine", () => {
  it("formats the Prism example", () =>
    expect(formatPromptLine(make("locked-1", [1]))).toBe("v1 · locked rules + guidance v1 · pinned to this run"));
  it("uses the highest guidance number", () =>
    expect(formatPromptLine(make("locked-2", [1, 3, 2]))).toBe("v2 · locked rules + guidance v3 · pinned to this run"));
  it("falls back to the raw id", () =>
    expect(formatPromptLine(make("abc", []))).toBe("vabc · locked rules + guidance v0 · pinned to this run"));
});
