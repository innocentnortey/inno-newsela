import { describe, expect, it } from "vitest";
import * as checks from "./checks.ts";
import * as generation from "./generation.ts";
import * as judge from "./judge.ts";


describe("worker wiring shells", () => {
  it("each names its filler", () => {
    expect([generation.FILLER, checks.FILLER, judge.FILLER]).toEqual(["NL-79", "NL-81", "NL-110"]);
  });
});
