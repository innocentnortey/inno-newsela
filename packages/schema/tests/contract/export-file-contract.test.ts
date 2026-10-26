// CHG-6 drift guard: the export file is described identically by the Zod ExportBundleFile, the published JSON Schema
// and the OpenAPI downloadExport response. A field added or renamed on one side fails here.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { ExportBundleFile } from "../../src/export.ts";
import { content_hash } from "../../src/content-hash.ts";
import { loadSpec } from "./oracle.ts";

const schemaUrl = new URL("../../../../docs/contracts/lesson-export.schema.json", import.meta.url);
const published = JSON.parse(readFileSync(schemaUrl, "utf8")) as {
  required: string[];
  properties: { lessons: { items: { required: string[] } } };
};

type Validate = ((d: unknown) => boolean) & { errors?: unknown[] | null };
// The root ajv is v6; the Ajv 2020 build the real-stack spec uses is the one under apps/web. No dependency is added.
const require_ = createRequire(new URL("../../../../apps/web/package.json", import.meta.url));
const Ajv2020 = (require_("ajv/dist/2020.js") as { default: new (o: object) => { compile: (s: object) => Validate } }).default;
const validate = new Ajv2020({ strict: false, validateFormats: false }).compile(published);

const stored = (n: number) => ({
  lesson_id: `G6.U4.L${n}`, schema_version: 1, title: "T", type: "Reading",
  front_matter: { standards: [], minutes_total: 50, vocabulary: [] }, sections: [], text_cards: [],
});
const record = (n: number) => {
  const lesson = stored(n);
  return { lesson_id: lesson.lesson_id, version_id: "lv_01ARZ3NDEKTSV4RRFFQ69G5FAV", content_hash: content_hash(lesson), approved_by: "usr_a", approved_at: "2026-10-25T12:00:00.000Z", lesson };
};
const bundle = { export_version: 1, unit_id: "G6.U4", generated_at: "2026-10-25T12:00:00.000Z", lessons: [record(31), record(32)] };

describe("export file contract (CHG-6)", () => {
  it("Zod accepts the bundle and rejects extra keys at both levels", () => {
    expect(ExportBundleFile.safeParse(bundle).success).toBe(true);
    expect(ExportBundleFile.safeParse({ ...bundle, label: "x" }).success).toBe(false);
    expect(ExportBundleFile.safeParse({ ...bundle, lessons: [{ ...record(31), extra: 1 }] }).success).toBe(false);
  });

  it("the published JSON Schema accepts the bundle and rejects the old drifted keys", () => {
    expect(validate(bundle), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...bundle, label: "Export (no live integration)" })).toBe(false);
    expect(validate({ ...bundle, payload_hash: "a".repeat(64) })).toBe(false);
  });

  it("the OpenAPI downloadExport response is ExportBundleFile and its examples satisfy both", () => {
    const spec = loadSpec();
    const json = spec.paths["/exports/{exportId}/download"].get.responses["200"].content["application/json"];
    expect(json.schema.$ref).toMatch(/\/ExportBundleFile$/);
    const examples = Object.values(json.examples ?? {}) as { value: unknown }[];
    expect(examples.length).toBeGreaterThan(0);
    for (const e of examples) {
      expect(ExportBundleFile.safeParse(e.value).success).toBe(true);
      expect(validate(e.value), JSON.stringify(validate.errors)).toBe(true);
    }
    expect(spec.components.schemas.LessonExportFile).toBeUndefined();
    expect(new Set(spec.components.schemas.ExportBundleFile.required)).toEqual(new Set(published.required));
    expect(new Set(spec.components.schemas.ExportedLessonRecord.required)).toEqual(new Set(published.properties.lessons.items.required));
  });
});
