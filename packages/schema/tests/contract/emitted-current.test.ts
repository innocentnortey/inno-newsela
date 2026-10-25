// NL-09 AC-9 [invariant] contract: committed schemas equal the emitter's output. WF-45.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emit_json_schemas } from "../../scripts/emit-json-schemas.ts";
import { ExportBundleFile } from "../../src/export.ts";
import { content_hash } from "../../src/content-hash.ts";

const root = new URL("../../../../docs/contracts/", import.meta.url).pathname;
const committed = (name: string): string => readFileSync(path.join(root, name === "lesson-export" ? "lesson-export.schema.json" : `schemas/${name}.schema.json`), "utf8");

describe("emitted schemas", () => {
  it("emits 5 rows, deterministic, equal to committed", () => {
    const a = emit_json_schemas(path.join(mkdtempSync(path.join(tmpdir(), "nl09-")), "schemas"));
    const dir2 = path.join(mkdtempSync(path.join(tmpdir(), "nl09-")), "schemas");
    const b = emit_json_schemas(dir2);
    expect(a).toHaveLength(5);
    expect(a.map((r) => r.sha256)).toEqual(b.map((r) => r.sha256));
    for (const r of a) {
      expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(readFileSync(r.path, "utf8")).toBe(committed(r.name));
    }
  });

  it("test_schemas_emit_clean", () => {
    const rows = emit_json_schemas(path.join(mkdtempSync(path.join(tmpdir(), "nl09-")), "schemas"));
    const exp = rows.find((r) => r.name === "lesson-export")!;
    expect(readFileSync(exp.path, "utf8")).toBe(committed("lesson-export"));
    const schema = JSON.parse(readFileSync(exp.path, "utf8")) as { required: string[] };
    expect(schema.required).toEqual(expect.arrayContaining(["export_version", "lessons"]));
    const lesson = { lesson_id: "G6.U4.L1", schema_version: 1, title: "T", type: "Reading", front_matter: { standards: [], minutes_total: 50, vocabulary: [] }, sections: [], text_cards: [] };
    const bundle = { export_version: 1, unit_id: "G6.U4", generated_at: "2026-10-25T12:00:00Z", lessons: [{ lesson_id: "G6.U4.L1", version_id: "lv_01ARZ3NDEKTSV4RRFFQ69G5FAV", content_hash: content_hash(lesson), approved_by: "r", approved_at: "2026-10-25T12:00:00Z", lesson }] };
    expect(ExportBundleFile.safeParse(bundle).success).toBe(true);
  });
});
