// NL-33 security finding: importing the raw recorder or provider client outside the allowed files must fail lint.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const eslint = new ESLint({ cwd: root, overrideConfigFile: "eslint.config.js" });

async function restricted(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, filePath) });
  return (result?.messages ?? []).filter((m) => m.ruleId === "no-restricted-imports");
}

describe("NL-33 paid-call bypass [negative]", () => {
  it.each([
    ["@ls/llm/recorder", 'import { ModelCallRecorder } from "@ls/llm/recorder";'],
    ["@ls/llm/anthropic", 'import { AnthropicClient } from "@ls/llm/anthropic";'],
    ["relative path", 'import { ModelCallRecorder } from "../../../packages/llm/src/recorder.ts";'],
  ])("a worker service importing %s is rejected", async (_n, code) => {
    expect((await restricted("apps/worker/src/generation/x.ts", code)).length).toBeGreaterThan(0);
  });

  it("core importing the recorder is rejected", async () => {
    expect((await restricted("packages/core/src/x.ts", 'import "@ls/llm/recorder";')).length).toBeGreaterThan(0);
  });

  it.each([
    ["packages/llm/src/paid-call.ts"],
    ["apps/worker/src/wiring/generation.ts"],
    ["apps/web/src/server/wiring/sessions.ts"],
    ["apps/worker/src/generation/x.test.ts"],
  ])("%s may import the recorder", async (file) => {
    expect(await restricted(file, 'import { ModelCallRecorder } from "@ls/llm/recorder";')).toEqual([]);
  });

  it("importing PaidCaller is allowed everywhere", async () => {
    expect(await restricted("apps/worker/src/generation/x.ts", 'import { PaidCaller } from "@ls/llm/paid-call";')).toEqual([]);
  });
});
