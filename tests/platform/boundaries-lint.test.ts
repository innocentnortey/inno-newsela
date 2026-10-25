// NL-01 AC-3: the boundaries rule rejects forbidden imports (inline code, no fixture files).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const eslint = new ESLint({ cwd: root, overrideConfigFile: "eslint.config.js" });

async function lint(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, filePath) });
  expect(result).toBeDefined();
  const r = result!;
  expect(r.filePath.endsWith(filePath)).toBe(true);
  expect(r.messages.some((m) => /ignored/i.test(m.message))).toBe(false);
  return r.messages.filter((m) => m.ruleId?.startsWith("boundaries/"));
}

const CORE = "packages/core/src/x.ts";

describe("NL-01 AC-3 boundaries [negative]", () => {
  it.each([
    ["pg", 'import "pg";'],
    ["@anthropic-ai/sdk", 'import "@anthropic-ai/sdk";'],
    ["yjs", 'import "yjs";'],
    ["next", 'import "next";'],
    ["node:http", 'import "node:http";'],
    ["@ls/db", 'import "@ls/db/package";'],
  ])("core importing %s is rejected", async (_n, code) => {
    expect((await lint(CORE, code)).length).toBeGreaterThan(0);
  });

  it("an app importing another app is rejected", async () => {
    const msgs = await lint("apps/worker/src/x.ts", 'import "@ls/collab/package";');
    expect(msgs.length).toBeGreaterThan(0);
  });

  it.each([
    ["xlsx", 'import "xlsx";'],
    ["compromise", 'import "compromise";'],
    ["@ls/schema", 'import "@ls/schema/package";'],
  ])("core importing %s is allowed", async (_n, code) => {
    expect(await lint(CORE, code)).toEqual([]);
  });
});
