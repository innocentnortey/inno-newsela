import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { Sha256 } from "./ids.ts";
import type { StoredLesson } from "./lesson.ts";

export function canonical_json(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("non-finite number");
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) return `[${value.map((v) => canonical_json(v === undefined ? null : v)).join(",")}]`;
      const o = value as Record<string, unknown>;
      const parts: string[] = [];
      for (const k of Object.keys(o).sort()) {
        const v = o[k];
        if (v === undefined) continue;
        parts.push(`${JSON.stringify(k)}:${canonical_json(v)}`);
      }
      return `{${parts.join(",")}}`;
    }
    default:
      throw new TypeError(`cannot canonicalise ${typeof value}`);
  }
}

export function content_hash(lesson: StoredLesson): Sha256 {
  return bytesToHex(sha256(utf8ToBytes(canonical_json(lesson))));
}
