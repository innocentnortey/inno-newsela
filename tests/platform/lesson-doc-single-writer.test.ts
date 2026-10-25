// NL-36 frozen test, AC-7 [invariant]: only packages/db/src/repos/lesson-docs.ts inserts into lesson_doc.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WRITER = "packages/db/src/repos/lesson-docs.ts";
const SKIP = new Set(["node_modules", ".git", "dist", ".next", "coverage"]);
// whitespace-tolerant, case-insensitive, may span lines; "lesson_docs" and other names do not match
const INSERT = /insert\s+into\s+(?:public\.)?"?lesson_doc"?(?![A-Za-z0-9_])/i;

function ts_files(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) ts_files(full, out);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const writers = (): string[] =>
  ["apps", "packages", "ops", "evals", "load"]
    .flatMap((d) => ts_files(path.join(root, d)))
    .filter((f) => !f.includes(`${path.sep}e2e${path.sep}`)) // real-stack test seeds (NL-98/NL-100) write fixture rows by SQL; product code still has exactly one writer
    .filter((f) => INSERT.test(readFileSync(f, "utf8")))
    .map((f) => path.relative(root, f).split(path.sep).join("/"))
    .sort();

describe("lesson_doc_single_writer [invariant, AC-7]", () => {
  it("exactly one module inserts into lesson_doc: the store", () => {
    expect(writers()).toEqual([WRITER]);
  });

  it("the store module exists and holds the statement", () => {
    expect(existsSync(path.join(root, WRITER))).toBe(true);
    expect(INSERT.test(readFileSync(path.join(root, WRITER), "utf8"))).toBe(true);
  });

  it("[boundary] the detector catches spacing, case and schema-qualified variants but not lesson_docs", () => {
    expect(INSERT.test("INSERT   INTO\n lesson_doc (a)")).toBe(true);
    expect(INSERT.test("insert into public.lesson_doc")).toBe(true);
    expect(INSERT.test('insert into "lesson_doc"')).toBe(true);
    expect(INSERT.test("insert into lesson_docs")).toBe(false);
  });
});
