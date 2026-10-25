// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DESIGN_PATH, OUT_PATH, extractTokens } from "../../../scripts/build-tokens.mjs";
import { declarations, findBlock } from "./css";

const css = fs.readFileSync(OUT_PATH, "utf8");
const globals = fs.readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf8");
const tokens = extractTokens(fs.readFileSync(DESIGN_PATH, "utf8"));

const darkMap = new Map<string, string>(
  [
    ...Object.entries(tokens.colors.dark).map(([k, v]) => [`--color-${k}`, v] as const),
    ...Object.entries(tokens.elevation.dark).map(([k, v]) => [`--shadow-${k}`, v] as const),
  ] as [string, string][],
);

describe("theme", () => {
  it("no data-theme follows the system", () => {
    const media = findBlock(css, "@media (prefers-color-scheme: dark)");
    expect(media).not.toBeNull();
    const inner = findBlock(media!.body, ":root:not([data-theme])");
    expect(inner).not.toBeNull();
    expect(declarations(inner!.body)).toEqual(darkMap);
    expect(declarations(findBlock(css, ":root")!.body).size).toBe(0);
    expect(findBlock(css, ":root")!.body).toContain("color-scheme: light dark;");
  });

  it('data-theme="dark" forces dark', () => {
    const block = findBlock(css, '[data-theme="dark"]')!;
    expect(declarations(block.body)).toEqual(darkMap);
    expect(block.body).toContain("color-scheme: dark;");
  });

  it('data-theme="light" forces light', () => {
    const block = findBlock(css, '[data-theme="light"]')!;
    expect(block.body).toContain("color-scheme: light;");
    expect(block.body).not.toContain("--color-");
  });

  it("reduced motion zeroes transition durations", () => {
    const block = findBlock(css, "@media (prefers-reduced-motion: reduce)")!;
    const d = declarations(block.body);
    for (const k of ["fast", "base", "slow"]) expect(d.get(`--duration-${k}`)).toBe("0ms");
    expect(d.has("--duration-indicator-delay")).toBe(false);
    expect(globals).toContain("prefers-reduced-motion: reduce");
    expect(globals).toContain("transition-duration: 0ms");
  });

  it("globals.css contains no colour literals", () => {
    expect(globals).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(globals).not.toMatch(/rgba?\(/);
  });

  it("focus ring uses the focus token", () => {
    expect(globals).toContain(":focus-visible");
    expect(globals).toContain("var(--color-focus)");
    expect(globals).not.toContain("outline: none");
  });
});
