// NL-32 FROZEN (AC-6). Do not edit.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Built in two halves so this file does not match its own scan.
const NEEDLE = "@anthropic-" + "ai/sdk";
const ROOT = resolve(import.meta.dirname, "../../..");
const DIRS = ["apps", "packages", "evals", "ops", "load"];

function walk(dir: string, out: string[]): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const n of names) {
    if (n === "node_modules" || n === ".git") continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (n.endsWith(".ts")) out.push(p);
  }
}

describe("sdk_import_boundary [negative AC-6]", () => {
  it("only packages/llm/src/anthropic.ts mentions the provider SDK", () => {
    const files: string[] = [];
    for (const d of DIRS) walk(join(ROOT, d), files);
    const hits = files
      .filter((f) => readFileSync(f, "utf8").includes(NEEDLE))
      .map((f) => relative(ROOT, f))
      .sort();
    expect(hits).toEqual(["packages/llm/src/anthropic.ts"]);
  });
});
