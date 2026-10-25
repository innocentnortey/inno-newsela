// AC-4: the 36 error codes agree across the mirror, the component enum and x-error-catalog.
import { describe, expect, it } from "vitest";
import { API_ERROR_CODES, ErrorCode } from "../../src/api/common.ts";
import { loadSpec } from "./oracle.ts";

const spec = loadSpec();
const sorted = (a: readonly string[]) => [...a].sort();

describe("error codes", () => {
  it("API_ERROR_CODES has 36 entries", () => {
    expect(API_ERROR_CODES).toHaveLength(36);
  });
  it("matches ErrorCode.options", () => {
    expect(sorted(API_ERROR_CODES)).toEqual(sorted(ErrorCode.options));
  });
  it("matches components.schemas.ErrorCode.enum", () => {
    expect(sorted(API_ERROR_CODES)).toEqual(sorted(spec.components.schemas.ErrorCode.enum));
  });
  it("matches x-error-catalog.codes keys", () => {
    expect(sorted(API_ERROR_CODES)).toEqual(sorted(Object.keys(spec["x-error-catalog"].codes)));
  });
});
