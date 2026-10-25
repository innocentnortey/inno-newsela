// NL-92: pure parts of planting (no database): mutations, key refusals.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { StoredLesson } from "@ls/schema/lesson";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { read_key } from "./key.ts";
import { apply_plant, planted_in, type Plant } from "./mutations.ts";

const REPO = path.join(import.meta.dirname, "../../..");
const FIXTURE = path.join(REPO, "evals/tests/fixtures/seed/key-5-plants.json");
const wp1 = (): StoredLesson => JSON.parse(fs.readFileSync(path.join(REPO, "packages/ydoc/tests/fixtures/stored-wp1.json"), "utf8")) as StoredLesson;
const plants = (): Plant[] => JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Plant[];

let root: string;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl92-key-"));
  fs.mkdirSync(path.join(root, "evals/local"), { recursive: true });
  fs.copyFileSync(FIXTURE, path.join(root, "evals/local/seed-key-t.json"));
  fs.copyFileSync(FIXTURE, path.join(root, "seed-key-outside.json"));
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("apply_plant", () => {
  it.each(plants().map((p) => [p.kind, p] as const))("%s plants on a copy and is detectable", (_kind, p) => {
    const src = wp1();
    const before = JSON.stringify(src);
    expect(planted_in(src, p)).toBe(false);
    const out = apply_plant(src, p);
    expect(JSON.stringify(src)).toBe(before); // source untouched
    expect(out.lesson_id).toBe(p.lesson_id);
    expect(planted_in(out, p)).toBe(true);
  });
});

describe("read_key", () => {
  it("reads a key under evals/local and names it by file", async () => {
    const k = await read_key("evals/local/seed-key-t.json", root);
    expect(k.key_id).toBe("seed-key-t");
    expect(k.plants).toHaveLength(5);
  });
  it("refuses a key outside evals/local and a malformed one without echoing content", async () => {
    await expect(read_key("seed-key-outside.json", root)).rejects.toThrow("evals/local");
    fs.writeFileSync(path.join(root, "evals/local/bad.json"), JSON.stringify([{ plant_id: "SECRET-TEXT" }]));
    const e = await read_key("evals/local/bad.json", root).catch((x: unknown) => x as Error);
    expect(String((e as Error).message) + JSON.stringify((e as { details?: unknown }).details)).not.toContain("SECRET-TEXT");
  });
  it("refuses a key tracked by git", async () => {
    const g = fs.mkdtempSync(path.join(os.tmpdir(), "nl92-git-"));
    try {
      fs.mkdirSync(path.join(g, "evals/local"), { recursive: true });
      fs.copyFileSync(FIXTURE, path.join(g, "evals/local/seed-key-t.json"));
      execFileSync("git", ["init", "-q"], { cwd: g });
      execFileSync("git", ["add", "-f", "evals/local/seed-key-t.json"], { cwd: g });
      await expect(read_key("evals/local/seed-key-t.json", g)).rejects.toThrow("tracked");
    } finally {
      fs.rmSync(g, { recursive: true, force: true });
    }
  });
});
