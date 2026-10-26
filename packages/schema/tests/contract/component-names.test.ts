// AC-1: one mirror per OpenAPI component, plus the four named extras; nothing else.
import { describe, expect, it } from "vitest";
import { loadSpec, mirrors } from "./oracle.ts";

const EXTRAS = ["StoredMessage", "ModeMessage", "RefusedMessage", "TransitionRequestInput"];

describe("component names", () => {
  const components = Object.keys(loadSpec().components.schemas).sort();
  const exported = Object.keys(mirrors)
    .filter((n) => n !== "ApiErrorCode")
    .sort();
  const expected = [...components, ...EXTRAS].sort();

  it("spec has 109 components", () => {
    expect(components).toHaveLength(109);
  });
  it("no component is missing a mirror", () => {
    expect(expected.filter((n) => !exported.includes(n))).toEqual([]);
  });
  it("no mirror lacks a component or extra", () => {
    expect(exported.filter((n) => !expected.includes(n))).toEqual([]);
  });
  it("113 mirrors are counted", () => {
    expect(exported).toHaveLength(113);
  });
});
