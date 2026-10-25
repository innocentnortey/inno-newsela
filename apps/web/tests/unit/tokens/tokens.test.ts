// @vitest-environment node
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DESIGN_PATH,
  OUT_PATH,
  buildTokensCss,
  extractTokens,
} from "../../../scripts/build-tokens.mjs";
import { declarations, findBlock } from "./css";
import { ratio } from "./contrast";

const md = fs.readFileSync(DESIGN_PATH, "utf8");
const css = fs.readFileSync(OUT_PATH, "utf8");
const tokens = extractTokens(md);

const light = declarations(findBlock(css, "@theme static")!.body);
const dark = declarations(findBlock(css, '[data-theme="dark"]')!.body);
const mediaInner = findBlock(findBlock(css, "@media (prefers-color-scheme: dark)")!.body, ":root:not([data-theme])")!;
const darkMedia = declarations(mediaInner.body);

type Pair = { kind: "text" | "ui"; fg: string; bg: string; needs: number };
const pairs: Pair[] = [];
for (const line of md.split("\n")) {
  const m = line.match(/^\|\s*(text|ui)\s*\|\s*`([\w-]+)`\s+on\s+`([\w-]+)`\s*\|\s*(4\.5|3):1\s*\|/);
  if (m) pairs.push({ kind: m[1] as Pair["kind"], fg: m[2]!, bg: m[3]!, needs: Number(m[4]) });
}

describe("tokens.css", () => {
  it("tokens.css matches design.md tokens block", () => {
    expect(css).toBe(buildTokensCss(tokens));
  });

  it("a changed token value changes the generated css", () => {
    const changed = structuredClone(tokens);
    changed.colors.light.ground = "#F4F5F8";
    expect(buildTokensCss(changed)).not.toBe(css);
  });

  it("extractTokens rejects a document without exactly one tokens block", () => {
    const block = "```json tokens\n{}\n```";
    expect(() => extractTokens("")).toThrow();
    expect(() => extractTokens(`${block}\n\n${block}`)).toThrow();
  });

  it("light and dark define the same colour names", () => {
    expect(Object.keys(tokens.colors.dark).sort()).toEqual(Object.keys(tokens.colors.light).sort());
    for (const theme of ["light", "dark"] as const) {
      for (const v of Object.values(tokens.colors[theme]) as string[]) {
        expect(v).toMatch(/^(#[0-9A-Fa-f]{6}|rgba\(.+\))$/);
      }
    }
  });

  it("dark theme values are identical in the data-theme block and the media block", () => {
    expect(darkMedia).toEqual(dark);
  });

  it("parses every row of the contrast table", () => {
    expect(pairs.length).toBeGreaterThanOrEqual(59);
  });

  const cases = pairs.flatMap((p) => (["light", "dark"] as const).map((theme) => ({ ...p, theme })));
  it.each(cases)("contrast $fg on $bg ($kind) [$theme]", ({ fg, bg, needs, theme }) => {
    const map = theme === "light" ? light : dark;
    const f = map.get(`--color-${fg}`);
    const b = map.get(`--color-${bg}`);
    expect(f, `--color-${fg} missing in ${theme}`).toBeDefined();
    expect(b, `--color-${bg} missing in ${theme}`).toBeDefined();
    expect(ratio(f!, b!)).toBeGreaterThanOrEqual(needs);
  });
});
