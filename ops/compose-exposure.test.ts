// NL-83 AC-9 (invariant, read-only): Postgres is not published by the Compose file the processes run under.
// No docker call, no image build: parse the YAML. NL-23 owns the file; this guards it (already true on main).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("NL-83 compose exposure (OBS-10)", () => {
  it("postgres_not_published", () => {
    const doc = parse(readFileSync(path.join(root, "docker-compose.yml"), "utf8")) as { services: Record<string, { ports?: unknown }> };
    expect(doc.services["postgres"], "postgres service exists").toBeDefined();
    expect(doc.services["postgres"]!.ports).toBeUndefined();
  });
});
