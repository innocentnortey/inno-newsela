import { describe, expect, it } from "vitest";
import { landingFor, resolveLanding } from "@/features/sign-in/next-param";

describe("resolveLanding", () => {
  it("lands each role", () => {
    expect(landingFor("author")).toBe("/units");
    expect(landingFor("reviewer")).toBe("/units/g6-u4/board");
    expect(landingFor("approver")).toBe("/units/g6-u4/board");
  });
  for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/sign-in", "/sign-in?next=/units", "units", "/a\nb", ""]) {
    it(`ignores ${JSON.stringify(bad)}`, () => expect(resolveLanding("author", bad)).toBe("/units"));
  }
  it("keeps a same-site path with a query", () => {
    expect(resolveLanding("author", "/units/g6-u4/lessons/L4?issue=i1")).toBe("/units/g6-u4/lessons/L4?issue=i1");
  });
  it("falls back to the role landing for null", () => expect(resolveLanding("reviewer", null)).toBe("/units/g6-u4/board"));
});
