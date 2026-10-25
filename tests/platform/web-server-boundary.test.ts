// NL-06 AC-6: browser code never imports the web server layer; container.ts is server-only.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = join(import.meta.dirname, "../../apps/web");
const walk = (dir: string): string[] =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
      });
const IMPORTS_SERVER = /from\s+["'](?:@\/server|(?:\.\.?\/)+(?:src\/)?server)[/"']|import\s+["']@\/server/;

describe("NL-06 web server boundary", () => {
  it("no component imports src/server", () => {
    for (const f of walk(join(WEB, "src/components"))) {
      expect(IMPORTS_SERVER.test(readFileSync(f, "utf8")), f).toBe(false);
    }
  });
  it("no 'use client' file under app/ imports src/server", () => {
    for (const f of walk(join(WEB, "app"))) {
      const src = readFileSync(f, "utf8");
      if (/^\s*["']use client["']/.test(src)) expect(IMPORTS_SERVER.test(src), f).toBe(false);
    }
  });
  it("container.ts imports server-only", () => {
    expect(readFileSync(join(WEB, "src/server/container.ts"), "utf8")).toMatch(/^import "server-only";$/m);
  });
});
