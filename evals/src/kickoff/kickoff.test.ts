// NL-108 (WF-46) AC-1, AC-2, AC-3, AC-4 (unit), AC-6.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "./cli.ts";
import { collect_kickoff } from "./collect.ts";
import { esc, render_kickoff } from "./render.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(HERE, "testing/fixture-root");
const REPO_ROOT = path.resolve(HERE, "../../..");
const NOW = (): Date => new Date("2026-10-25T12:00:00.000Z");
const OPTS = { now: NOW, git_sha: "abc123def456" };

const tmp: string[] = [];
function scratch_fixture(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kickoff-"));
  tmp.push(dir);
  cpSync(FIXTURE_ROOT, dir, { recursive: true });
  return dir;
}
afterEach(() => {
  for (const d of tmp.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function layer_blocks(page: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of page.matchAll(/<section class="card" id="(layer-[^"]+)">[\s\S]*?<\/section>/g)) out.set(m[1] as string, m[0]);
  return out;
}

describe("kickoff page", () => {
  it("test_kickoff_page_from_code", () => {
    const d = collect_kickoff(FIXTURE_ROOT, OPTS);
    const page = render_kickoff(d);
    console.log("layers:", d.layers.map((l) => `${l.file}@${l.version}`).join(", "));
    console.log("nodes:", d.nodes.map((n) => n.name).join(", "));
    console.log("fc ids:", d.fc.map((f) => f.id).join(", "));
    expect(d.layers).toHaveLength(3);
    for (const l of d.layers) {
      expect(page).toContain(esc(l.text));
      expect(page).toContain(l.version);
      expect(page).toContain(l.sha256);
    }
    expect(d.nodes.map((n) => n.name)).toEqual(["draft", "store"]);
    for (const n of d.nodes) expect(page).toContain(esc(n.name));
    expect(d.fc.map((f) => f.id)).toEqual(["FC-1", "FC-2", "FC-3"]);
    for (const f of d.fc) expect(page).toContain(f.id);
    expect(page).toContain("abc123def456");
    expect(page).toContain("2026-10-25T12:00:00.000Z");
    expect(page).toContain("render_lesson_draft");
    expect(d.route_table).toHaveLength(3);
    // HP-1 text is escaped, never live markup.
    expect(page).toContain("One call plus one repair &lt;script&gt;.");
    expect(page).not.toContain("<script");
    expect(d.settled["model"]).toBe("fixture-model");
  });

  it("page_follows_prompt_change", () => {
    const before = render_kickoff(collect_kickoff(FIXTURE_ROOT, OPTS));
    const dir = scratch_fixture();
    const file = path.join(dir, "packages/prompts/locked/lesson-draft.md");
    writeFileSync(file, readFileSync(file, "utf8").replace("Fixture", "Fixturf"));
    const after = render_kickoff(collect_kickoff(dir, OPTS));
    const a = layer_blocks(before);
    const b = layer_blocks(after);
    expect([...a.keys()]).toEqual([...b.keys()]);
    const differing = [...a.keys()].filter((k) => a.get(k) !== b.get(k));
    expect(differing).toEqual(["layer-lesson-draft.md"]);
    const v = (p: string): string => /version <code>([0-9a-f]{12})/.exec(p)?.[1] ?? "";
    expect(v(a.get("layer-lesson-draft.md") ?? "")).not.toBe(v(b.get("layer-lesson-draft.md") ?? ""));
  });

  describe("failure_types", () => {
    it("shows none yet when no FT heading exists", () => {
      const d = collect_kickoff(FIXTURE_ROOT, OPTS);
      expect(d.ft).toEqual([]);
      expect(render_kickoff(d)).toContain("none yet");
    });

    it("lists both FT headings of an error-analysis file", () => {
      const dir = scratch_fixture();
      writeFileSync(
        path.join(dir, "docs/testing/error-analysis/round-1.md"),
        "# Round 1\n\n## FT-1: Missing warm-up\ntext\n\n### FT-2 Wrong grade band\n",
      );
      const d = collect_kickoff(dir, OPTS);
      expect(d.ft.map((f) => f.id)).toEqual(["FT-1", "FT-2"]);
      const page = render_kickoff(d);
      expect(page).toContain("Missing warm-up");
      expect(page).toContain("Wrong grade band");
      expect(page).not.toContain("none yet");
    });
  });
});

describe("real repo", () => {
  it("collects the real files and renders a standalone page", () => {
    const d = collect_kickoff(REPO_ROOT, OPTS);
    expect(d.fc).toHaveLength(14);
    expect(d.nodes.map((n) => n.name)).toEqual(["draft", "compile_check", "repair", "store", "fail"]);
    expect(d.layers).toHaveLength(9);
    expect(Object.keys(d.settled).sort()).toEqual(["concurrency", "effort", "max_tokens", "model", "per_call_timeout", "per_run_cap"]);
    expect(Object.values(d.settled).filter((v) => v.includes("not found"))).toEqual([]);
    expect(d.ft).toHaveLength(0);
    expect(d.renderers.length).toBeGreaterThanOrEqual(5);
    const page = render_kickoff(d);
    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page).toMatch(/<html lang="en">/);
    expect(page).toMatch(/<meta charset="utf-8">/);
    expect(page).toMatch(/name="viewport"/);
    expect(page).toMatch(/<title>Experiment kickoff<\/title>/);
    expect(page).toMatch(/prefers-color-scheme:dark/);
    for (const bad of ['src="http', 'href="http', "<script", 'rel="stylesheet"']) expect(page).not.toContain(bad);
    expect([...page.matchAll(/href="([^"]*)"/g)].every((m) => (m[1] as string).startsWith("#"))).toBe(true);
  });
});

describe("canary key", () => {
  it("never reaches the page", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "kickoff-out-"));
    tmp.push(dir);
    const out = path.join(dir, "sub/k.html");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await main(["--out", out], { OPENROUTER_API_KEY: "KICKOFF-CANARY-9", GIT: "x" }, { root: FIXTURE_ROOT, now: NOW });
    mkdirSync(dir, { recursive: true });
    expect(code).toBe(0);
    expect(readFileSync(out, "utf8")).not.toContain("KICKOFF-CANARY-9");
  });

  it("exits 2 without --out", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(await main([], {}, { root: FIXTURE_ROOT })).toBe(2);
  });
});
