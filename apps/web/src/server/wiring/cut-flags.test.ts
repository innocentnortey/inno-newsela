// NL-104: CUT_FLAGS parsing for the server-side cut #6 switch.
import { describe, expect, it } from "vitest";
import { parse_cut_flags } from "./metrics.ts";

describe("parse_cut_flags", () => {
  it("empty or undefined is no cut", () => {
    expect(parse_cut_flags(undefined)).toEqual([]);
    expect(parse_cut_flags("")).toEqual([]);
  });
  it("reads a comma list and ignores junk", () => {
    expect(parse_cut_flags("6")).toEqual([6]);
    expect(parse_cut_flags(" 6 , 2,x,10,0,6.5")).toEqual([6, 2]);
  });
});
