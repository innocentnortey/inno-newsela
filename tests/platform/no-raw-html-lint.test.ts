// NL-01 AC-4: raw HTML injection is a lint error under apps/web.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const eslint = new ESLint({ cwd: root, overrideConfigFile: "eslint.config.js" });

async function rule_ids(filePath: string, code: string) {
  const [r] = await eslint.lintText(code, { filePath: path.join(root, filePath) });
  return r!.messages.map((m) => m.ruleId);
}

describe("NL-01 AC-4 no raw HTML [negative]", () => {
  it("dangerouslySetInnerHTML is rejected", async () => {
    const ids = await rule_ids("apps/web/src/x.tsx", "export const A = (a: string) => <div dangerouslySetInnerHTML={{ __html: a }} />;\n");
    expect(ids).toContain("no-restricted-syntax");
  });
  it("innerHTML assignment is rejected", async () => {
    const ids = await rule_ids("apps/web/src/y.ts", "export function f(el: HTMLElement, a: string) { el.innerHTML = a; }\n");
    expect(ids).toContain("no-restricted-syntax");
  });
  it("clean code passes", async () => {
    const ids = await rule_ids("apps/web/src/z.tsx", "export const A = () => <div>hi</div>;\n");
    expect(ids).not.toContain("no-restricted-syntax");
  });
});
