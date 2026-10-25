// CHG-2: the 28 CheckKind values agree between the Zod Issue.kind mirror and OpenAPI Issue.kind (DO-4 CheckKind).
import { describe, expect, it } from "vitest";
import { Issue } from "../../src/api/lessons.ts";
import { loadSpec } from "./oracle.ts";

const spec = loadSpec();
const sorted = (a: readonly string[]) => [...a].sort();

describe("check kinds", () => {
  it("has 28 kinds including schema_invalid", () => {
    expect(Issue.shape.kind.options).toHaveLength(28);
    expect(Issue.shape.kind.options).toContain("schema_invalid");
  });
  it("matches components.schemas.Issue.properties.kind.enum", () => {
    expect(sorted(Issue.shape.kind.options)).toEqual(sorted(spec.components.schemas.Issue.properties.kind.enum));
  });
});
