import { describe, expect, it } from "vitest";
import {
  availableControls,
  controlErrorText,
  failureLine,
  formatUsd,
  pausedSentence,
  unitLabel,
} from "@/features/progress/run-copy";
import { progress, tile } from "./fixtures";

describe("run-copy", () => {
  it("lists controls for all seven states", () => {
    expect(availableControls("planning")).toEqual(["cancel"]);
    expect(availableControls("running")).toEqual(["cancel"]);
    expect(availableControls("paused")).toEqual(["resume", "cancel"]);
    expect(availableControls("partial")).toEqual(["retry_failed"]);
    for (const s of ["complete", "capped", "cancelled"] as const)
      expect(availableControls(s)).toEqual([]);
  });
  it("words failures", () => {
    expect(failureLine(tile(1, "failed"))).toBe("Failed");
    expect(
      failureLine(
        tile(5, "failed", {
          repair_used: true,
          failure_reasons: [
            {
              check: "check_failed",
              message: "Look Back is 3 minutes (needs 5)",
            },
          ],
        }),
      ),
    ).toBe("Failed after 1 repair: Look Back is 3 minutes (needs 5)");
    expect(
      failureLine(
        tile(6, "failed", {
          truncation_retry_used: true,
          failure_reasons: [{ check: "truncated", message: "x" }],
        }),
      ),
    ).toBe("Failed: truncated (retried once with a bigger limit)");
    expect(
      failureLine(
        tile(6, "failed", {
          failure_reasons: [{ check: "truncated", message: "x" }],
        }),
      ),
    ).toBe("Failed: truncated");
  });
  it("words the pause, the control errors, money and the unit", () => {
    const t = [
      tile(1, "failed", {
        failure_reasons: [
          { check: "check_failed", message: "Exit ticket missing" },
        ],
      }),
      tile(2, "failed"),
      tile(3, "failed"),
    ];
    const p = progress("paused", t, {
      paused_reason: {
        check: "exit_ticket",
        lesson_ids: ["G6.U4.L1", "G6.U4.L2", "G6.U4.L3"],
      },
    });
    expect(pausedSentence(p)).toBe(
      "Run paused: 3 lessons in a row failed the same check (Exit ticket missing). Read the failures, then resume.",
    );
    const q = progress("paused", [tile(1, "failed")], {
      paused_reason: { check: "exit_ticket", lesson_ids: ["G6.U4.L1"] },
    });
    expect(pausedSentence(q)).toContain("(exit_ticket)");
    expect(controlErrorText("cancel")).toBe(
      "Couldn't cancel. Nothing changed. Try again.",
    );
    expect(controlErrorText("retry_failed")).toBe(
      "Couldn't retry. Nothing changed. Try again.",
    );
    expect(controlErrorText("resume")).toBe(
      "Couldn't resume. Nothing changed. Try again.",
    );
    expect(formatUsd(1.8)).toBe("$1.80");
    expect(unitLabel("g6-u4")).toBe("Grade 6 · Unit 4");
    expect(unitLabel("odd")).toBe("odd");
  });
});
