import { describe, expect, it } from "vitest";
import type { WorkerDeps } from "../deps-types.ts";
import * as checks from "./checks.ts";
import * as generation from "./generation.ts";
import * as judge from "./judge.ts";

const deps = {} as WorkerDeps;

describe("worker wiring shells", () => {
  it("wire_generation/checks/judge return empty records", () => {
    expect(generation.wire_generation(deps)).toEqual({});
    expect(checks.wire_checks(deps)).toEqual({});
    expect(judge.wire_judge(deps)).toEqual({});
  });
  it("each names its filler", () => {
    expect([generation.FILLER, checks.FILLER, judge.FILLER]).toEqual(["NL-79", "NL-81", "NL-110"]);
  });
});
