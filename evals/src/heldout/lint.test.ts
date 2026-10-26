// NL-121 AC-4 (frozen first): the held-out comparison imports no model client and no HTTP client.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const eslint = new ESLint({ cwd: root, overrideConfigFile: "eslint.config.js" });

async function hits(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, filePath) });
  return (result?.messages ?? []).filter((m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-globals");
}

describe("NL-121 import boundary", () => {
  it.each([
    ["the PaidCaller module", 'import "@ls/llm/paid-call";'],
    ["node:http", 'import "node:http";'],
    ["undici", 'import "undici";'],
    ["a global fetch", 'fetch("x");'],
  ])("no_model_or_http_import: %s is rejected under evals/src/heldout", async (_n, code) => {
    expect((await hits("evals/src/heldout/x.ts", code)).length).toBeGreaterThan(0);
  });

  it("no_model_or_http_import: the same text elsewhere in evals is not caught by this block", async () => {
    expect(await hits("evals/src/suites/x.ts", 'import "node:http";')).toEqual([]);
  });

  it("no_model_or_http_import: a plain node:fs import is clean under evals/src/heldout", async () => {
    expect(await hits("evals/src/heldout/x.ts", 'import "node:fs";')).toEqual([]);
  });
});
