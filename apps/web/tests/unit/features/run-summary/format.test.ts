import { describe, expect, it } from "vitest";
import {
  formatNumber,
  formatUsd,
  isGoing,
  nText,
  unitLabel,
} from "@/features/run-summary/format";

describe("run-summary format", () => {
  it("pads dollars but never drops a digit", () => {
    expect(formatUsd(1.61)).toBe("$1.61");
    expect(formatUsd(0.4999)).toBe("$0.4999");
    expect(formatUsd(2)).toBe("$2.00");
    expect(formatUsd(0.5)).toBe("$0.50");
  });
  it("shows numbers as stored", () => {
    expect(formatNumber(3.4)).toBe("3.4");
    expect(formatNumber(612)).toBe("612");
  });
  it("writes n with the right noun", () => {
    expect(nText(3)).toBe("n = 3 lessons");
    expect(nText(1)).toBe("n = 1 lesson");
  });
  it("labels the unit", () => {
    expect(unitLabel("g6-u4")).toBe("Grade 6 · Unit 4");
    expect(unitLabel("bad")).toBe("bad");
  });
  it("knows which states are still going", () => {
    for (const s of ["planning", "running", "paused"] as const)
      expect(isGoing(s)).toBe(true);
    for (const s of ["complete", "partial", "capped", "cancelled"] as const)
      expect(isGoing(s)).toBe(false);
  });
});
