import { describe, expect, it } from "vitest";
import { backoffMs } from "@/features/progress/backoff";

describe("backoffMs", () => {
  it("doubles from 4 s and tops out at 10 s", () => {
    expect([1, 2, 3, 9].map(backoffMs)).toEqual([4000, 8000, 10000, 10000]);
  });
});
