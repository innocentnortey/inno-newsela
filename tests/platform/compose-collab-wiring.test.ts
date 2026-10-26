// NL-126 F-2/F-3: Compose must point web at collab's /internal routes and bake the browser's collab URL at build time.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
type Svc = { build?: { args?: Record<string, string> }; environment?: Record<string, string> };
const compose = parse(fs.readFileSync(path.join(root, "docker-compose.yml"), "utf8")) as { services: Record<string, Svc> };
const dockerfile = fs.readFileSync(path.join(root, "Dockerfile.web"), "utf8");

describe("NL-126 compose collab wiring", () => {
  it("web COLLAB_INTERNAL_URL default ends with /internal", () => {
    const v = compose.services["web"]!.environment!["COLLAB_INTERNAL_URL"]!;
    const def = /^\$\{COLLAB_INTERNAL_URL:-([^}]+)\}$/.exec(v)?.[1] ?? v;
    expect(def).toBe("http://collab:1234/internal");
  });

  it("Dockerfile.web declares NEXT_PUBLIC_COLLAB_URL before the build step", () => {
    const lines = dockerfile.split("\n");
    const arg = lines.findIndex((l) => l.trim() === "ARG NEXT_PUBLIC_COLLAB_URL");
    const env = lines.findIndex((l) => l.trim() === "ENV NEXT_PUBLIC_COLLAB_URL=$NEXT_PUBLIC_COLLAB_URL");
    const build = lines.findIndex((l) => l.includes("npm run build -w @ls/web"));
    expect(arg).toBeGreaterThan(-1);
    expect(env).toBeGreaterThan(arg);
    expect(build).toBeGreaterThan(env);
    const runner = lines.findIndex((l) => l.startsWith("FROM") && l.includes("AS runner"));
    expect(lines.slice(runner).join("\n")).not.toContain("NEXT_PUBLIC_COLLAB_URL");
  });

  it("compose passes NEXT_PUBLIC_COLLAB_URL as a web build arg defaulting to the published collab port", () => {
    const v = compose.services["web"]!.build!.args!["NEXT_PUBLIC_COLLAB_URL"]!;
    expect(v).toBe("${NEXT_PUBLIC_COLLAB_URL:-ws://localhost:${COLLAB_PORT:-1234}}");
  });
});
