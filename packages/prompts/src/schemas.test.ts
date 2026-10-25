import { describe, expect, it } from "vitest";
import { SCHEMA_NAMES, SchemaRegistry, UnknownSchemaName } from "./schemas.ts";

const reg = new SchemaRegistry();
const D2020 = "https://json-schema.org/draft/2020-12/schema";

describe("schema registry", () => {
  for (const n of SCHEMA_NAMES) {
    it(`json_schema_${n}`, () => {
      const s = reg.json_schema(n) as Record<string, unknown>;
      expect(s["$schema"]).toBe(D2020);
      expect(s["title"]).toBe(n);
      expect(reg.json_schema(n)).toEqual(s);
    });
  }
  it("unknown_name_throws", () => {
    expect(() => reg.json_schema("Nope")).toThrow(UnknownSchemaName);
  });
  it("returns independent copies", () => {
    const a = reg.json_schema("JudgeVerdict") as Record<string, unknown>;
    a["title"] = "changed";
    expect((reg.json_schema("JudgeVerdict") as Record<string, unknown>)["title"]).toBe("JudgeVerdict");
  });
  it("verdict_enum_and_assist_required", () => {
    const v = reg.json_schema("JudgeVerdict") as { properties: { verdict: { enum: string[] } }; additionalProperties: boolean };
    expect(v.properties.verdict.enum).toEqual(["yes", "no"]);
    expect(v.additionalProperties).toBe(false);
    const a = reg.json_schema("AssistRewrite") as { required: string[] };
    expect(a.required).toEqual(["suggested_text"]);
  });
});
