import type { JsonValue } from "@ls/core/ports/common";

// Keywords the Anthropic structured-outputs endpoint rejects (HTTP 400) or cannot enforce. They are removed from the
// schema SENT to the model only; the Zod schema still validates every response, so the bounds stay enforced in code.
export const UNSUPPORTED_KEYWORDS = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "maxItems",
  "minContains",
  "maxContains",
  "uniqueItems",
  "minProperties",
  "maxProperties",
] as const;

/** Deep copy of a JSON schema with unsupported keywords removed; `minItems` is kept only when 0 or 1. */
export function sanitize_schema_for_anthropic(schema: JsonValue): Record<string, unknown> {
  return walk(schema) as Record<string, unknown>;
}

function walk(n: JsonValue): JsonValue {
  if (Array.isArray(n)) return n.map(walk);
  if (n === null || typeof n !== "object") return n;
  const out: { [k: string]: JsonValue } = {};
  for (const [k, v] of Object.entries(n)) {
    if ((UNSUPPORTED_KEYWORDS as readonly string[]).includes(k) && typeof v !== "object") continue;
    if (k === "minItems" && typeof v === "number" && v > 1) continue;
    out[k] = walk(v);
  }
  return out;
}
