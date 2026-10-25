import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const LOCKED_DIR: string = join(dirname(fileURLToPath(import.meta.url)), "..", "locked");

export const COMMON_FILES = ["content-rules.md", "data-delimiters.md", "grounding-rules.md", "lesson-shape.md"] as const;

export class LockedLayerMismatch extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`locked layer hash mismatch: expected ${expected}, found ${actual}`);
    this.name = "LockedLayerMismatch";
  }
}

/** sha256 over every .md file in `dir`, in code-unit name order: name, NUL, bytes. */
export function locked_hash(dir: string): string {
  const names = readdirSync(dir)
    .filter((n) => n.endsWith(".md"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const h = createHash("sha256");
  for (const n of names) {
    h.update(n);
    h.update("\0");
    h.update(readFileSync(join(dir, n)));
  }
  return h.digest("hex");
}

export function read_locked(dir: string, names: readonly string[]): string {
  return names.map((n) => readFileSync(join(dir, n), "utf8")).join("\n\n");
}
