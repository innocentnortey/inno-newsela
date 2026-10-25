// NL-09 AC-11/AC-12 WF-45 obligations
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emit_json_schemas } from "../scripts/emit-json-schemas.ts";
import { ExportBundleFile } from "./export.ts";
import { StoredLesson } from "./lesson.ts";

const here = new URL(".", import.meta.url).pathname;
const repo = path.resolve(here, "../../..");
const sources = [...readdirSync(here).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => path.join(here, f)), path.join(here, "../scripts/emit-json-schemas.ts")];
const rows = emit_json_schemas(path.join(mkdtempSync(path.join(tmpdir(), "nl09-")), "schemas"));
const emitted = rows.map((r) => readFileSync(r.path, "utf8"));
const all = [...sources.map((f) => readFileSync(f, "utf8")), ...emitted];
const keys = (x: unknown, out: string[] = []): string[] => {
  if (Array.isArray(x)) x.forEach((v) => keys(v, out));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) { out.push(k); keys(v, out); }
  return out;
};

describe("WF-45", () => {
  it("R-11 stored lesson is typed and versioned", () => {
    expect(StoredLesson.shape.schema_version).toBeDefined();
    expect(StoredLesson.safeParse({}).success).toBe(false);
  });
  it("R-42 export bundle is versioned with content_hash per lesson", () => {
    expect(ExportBundleFile.shape.export_version).toBeDefined();
    expect(emitted[4]).toContain('"content_hash"');
  });
  it("GR-9 nothing references restricted sources", () => {
    for (const s of all) expect(s).not.toContain("docs/source/restricted");
  });
  it("GR-13 no student or teacher_of_record fields", () => {
    for (const e of emitted) for (const k of keys(JSON.parse(e))) expect(k).not.toMatch(/^(student|teacher_of_record)/);
  });
  it("OBS-1 emitter rows carry sha256", () => {
    expect(rows).toHaveLength(5);
    for (const r of rows) expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("OBS-7 no provider secrets", () => {
    for (const s of all) expect(s).not.toMatch(/sk-ant|OPENROUTER/);
  });
  it("OBS-9 emitter writes no ops_event (no db import)", () => {
    const s = readFileSync(path.join(here, "../scripts/emit-json-schemas.ts"), "utf8");
    expect(s).not.toMatch(/@ls\/db|ops_event/);
  });
  it("OBS-11 observability lists WF-45", () => {
    expect(readFileSync(path.join(repo, "docs/design/observability.md"), "utf8")).toContain("WF-45");
  });
});
