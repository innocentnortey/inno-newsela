import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

it("no raw colour literals or dangerouslySetInnerHTML in src/features/candidate", () => {
  const dir = path.resolve(import.meta.dirname, "../../../../src/features/candidate");
  const files = readdirSync(dir);
  expect(files.length).toBeGreaterThan(5);
  for (const f of files) {
    const src = readFileSync(path.join(dir, f), "utf8");
    expect(src, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
    expect(src, f).not.toMatch(/dangerouslySetInnerHTML/);
  }
});
