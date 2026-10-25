import { LessonDraft } from "@ls/schema/lesson-draft";
import { UnitPlanDraft } from "@ls/schema/unit-plan";
import { z } from "zod";
import { AssistRewrite } from "./assist-rewrite.ts";
import { sort_keys } from "./data-block.ts";
import { JudgeVerdict } from "./judge-verdict.ts";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export const SCHEMA_NAMES = ["UnitPlanDraft", "LessonDraft", "AssistRewrite", "JudgeVerdict"] as const;
export type SchemaName = (typeof SCHEMA_NAMES)[number];

export class UnknownSchemaName extends Error {
  constructor(readonly name_given: string) {
    super(`unknown schema name: ${name_given}`);
    this.name = "UnknownSchemaName";
  }
}

const SOURCES: Record<SchemaName, z.ZodType> = { UnitPlanDraft, LessonDraft, AssistRewrite, JudgeVerdict };

export function schema_text(schema: JsonValue): string {
  return JSON.stringify(schema, null, 2) + "\n";
}

export class SchemaRegistry {
  private readonly cache = new Map<SchemaName, JsonValue>();

  json_schema(name: string): JsonValue {
    if (!(SCHEMA_NAMES as readonly string[]).includes(name)) throw new UnknownSchemaName(name);
    const key = name as SchemaName;
    let v = this.cache.get(key);
    if (v === undefined) {
      const raw = z.toJSONSchema(SOURCES[key], { target: "draft-2020-12", io: "output" }) as Record<string, unknown>;
      v = sort_keys({ ...raw, title: key }) as JsonValue;
      this.cache.set(key, v);
    }
    return structuredClone(v);
  }
}
