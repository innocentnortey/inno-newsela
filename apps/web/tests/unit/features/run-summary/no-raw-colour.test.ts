import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.resolve(
  import.meta.dirname,
  "../../../../src/features/run-summary",
);
const files = readdirSync(dir).map((f) => ({
  f,
  text: readFileSync(path.join(dir, f), "utf8"),
}));

describe("run-summary source", () => {
  it("has files to check", () => expect(files.length).toBeGreaterThan(5));
  it("uses no raw colour", () => {
    for (const { f, text } of files)
      expect(text, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
  it("implies no baseline and names no reviewer", () => {
    for (const { f, text } of files)
      expect(text, f).not.toMatch(/baseline|saved|faster than|reviewer/i);
  });
});
