import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(import.meta.dirname, "../../../../src/features/resolve");

describe("resolve feature", () => {
  it("uses tokens only, no colour literals", () => {
    for (const f of readdirSync(DIR)) {
      expect(readFileSync(path.join(DIR, f), "utf8"), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
    }
  });
  it("never touches browser storage", () => {
    for (const f of readdirSync(DIR)) {
      expect(readFileSync(path.join(DIR, f), "utf8"), f).not.toMatch(/localStorage|sessionStorage/);
    }
  });
});
