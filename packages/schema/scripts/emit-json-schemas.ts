import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { z } from "zod";
import { ExportBundleFile, type EmittedSchema } from "../src/export.ts";
import { LessonDraft } from "../src/lesson-draft.ts";
import { StoredLesson } from "../src/lesson.ts";
import { NormalizedOutline } from "../src/outline.ts";
import { UnitPlanDraft } from "../src/unit-plan.ts";

export type { EmittedSchema };

function sort_keys(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(sort_keys);
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sort_keys(o[k])]));
  }
  return x;
}

export function emit_json_schemas(out_dir: string): EmittedSchema[] {
  const targets: { name: string; schema: z.ZodType; file: string; title: string }[] = [
    { name: "outline", schema: NormalizedOutline, file: path.join(out_dir, "outline.schema.json"), title: "NormalizedOutline" },
    { name: "unit-plan", schema: UnitPlanDraft, file: path.join(out_dir, "unit-plan.schema.json"), title: "UnitPlanDraft" },
    { name: "lesson-draft", schema: LessonDraft, file: path.join(out_dir, "lesson-draft.schema.json"), title: "LessonDraft" },
    { name: "lesson", schema: StoredLesson, file: path.join(out_dir, "lesson.schema.json"), title: "StoredLesson" },
    { name: "lesson-export", schema: ExportBundleFile, file: path.join(out_dir, "..", "lesson-export.schema.json"), title: "ExportBundleFile" },
  ];
  mkdirSync(out_dir, { recursive: true });
  return targets.map((t) => {
    const raw = z.toJSONSchema(t.schema, { target: "draft-2020-12", io: "output" }) as Record<string, unknown>;
    const text = JSON.stringify(sort_keys({ ...raw, title: t.title }), null, 2) + "\n";
    writeFileSync(t.file, text);
    return {
      name: t.name,
      path: t.file.split(path.sep).join("/"),
      sha256: bytesToHex(sha256(new TextEncoder().encode(text))),
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  for (const r of emit_json_schemas(path.resolve(root, "docs/contracts/schemas"))) {
    console.log(`${r.name} ${path.relative(root, r.path)} ${r.sha256}`);
  }
}
