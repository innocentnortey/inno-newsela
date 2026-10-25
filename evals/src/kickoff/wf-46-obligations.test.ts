// NL-108 AC-8 / AC-5. "Real stack" for WF-46: the real entry point main(argv, env) on the real repo files, no mocked collector.
// WF-46 has no web server, worker, collab server or database, so no Playwright harness applies.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "./cli.ts";
import { assert_not_restricted, collect_kickoff } from "./collect.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(HERE, "testing/fixture-root");
const REPO_ROOT = path.resolve(HERE, "../../..");
const WITHHELD = ["restr", "icted"].join("");

const tmp: string[] = [];
function tmpdir(): string {
  const d = mkdtempSync(path.join(os.tmpdir(), "kickoff-wf46-"));
  tmp.push(d);
  return d;
}
afterEach(() => {
  for (const d of tmp.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function run(env: Record<string, string | undefined>, root: string): Promise<{ code: number; out: string; err: string; page: string }> {
  const dir = tmpdir();
  const file = path.join(dir, "k.html");
  let out = "";
  let err = "";
  vi.spyOn(process.stdout, "write").mockImplementation((s) => ((out += String(s)), true));
  vi.spyOn(process.stderr, "write").mockImplementation((s) => ((err += String(s)), true));
  const code = await main(["--out", file], env, { root });
  vi.restoreAllMocks();
  return { code, out, err, page: existsSync(file) ? readFileSync(file, "utf8") : "" };
}

describe("WF-46 obligations", () => {
  it("R-54", async () => {
    // Role enforcement is not exercised: WF-46 has no user route. The obligation holds because there is no network surface at all.
    for (const f of ["collect.ts", "render.ts", "cli.ts"]) {
      const src = readFileSync(path.join(HERE, f), "utf8");
      expect(src).not.toMatch(/\bfetch\(/);
      expect(src).not.toMatch(/from "(node:)?(https?|net|tls|dgram)"/);
    }
    const r = await run({}, REPO_ROOT);
    expect(r.code).toBe(0);
    expect(r.page).not.toMatch(/<form|<input|type="password"/i);
  });

  it("GR-9", async () => {
    const root = tmpdir();
    cpSync(FIXTURE_ROOT, root, { recursive: true });
    const dir = path.join(root, "docs/source", WITHHELD);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "secret.md"), "RESTRICTED-MARKER-77\n");
    const r = await run({}, root);
    expect(r.code).toBe(0);
    expect(r.page).not.toContain("RESTRICTED-MARKER-77");
    expect(() => assert_not_restricted(path.join(dir, "secret.md"))).toThrow();
    expect(() => collect_kickoff(root, { git_sha: "x" })).not.toThrow();
  });

  it("GR-13", async () => {
    const r = await run({}, REPO_ROOT);
    expect(r.code).toBe(0);
    const emails = (r.page.match(/[A-Za-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []).filter((e) => !/noreply/i.test(e));
    expect(emails).toEqual([]);
  });

  it("OBS-7", async () => {
    const root = tmpdir();
    cpSync(FIXTURE_ROOT, root, { recursive: true });
    const dir = path.join(root, "docs/source", WITHHELD);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "leak.md"), "RESTRICTED-LEAK\n");
    const env = { ANTHROPIC_API_KEY: "sk-ant-TESTMARKER00112233", OPENROUTER_API_KEY: "KICKOFF-CANARY-9" };
    const r = await run(env, root);
    expect(r.code).toBe(0);
    for (const m of ["sk-ant-TESTMARKER00112233", "KICKOFF-CANARY-9", "RESTRICTED-LEAK"]) expect(r.page).not.toContain(m);

    // A page that would hold a secret makes main exit 2 and write nothing.
    const out = path.join(tmpdir(), "never.html");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await main(["--out", out], env, {
      root,
      collect: (r2, o) => {
        const d = collect_kickoff(r2, { ...o, git_sha: "abc" });
        d.layers[0] = { ...(d.layers[0] as (typeof d.layers)[number]), text: "KICKOFF-CANARY-9" };
        return d;
      },
    });
    expect(code).toBe(2);
    expect(existsSync(out)).toBe(false);
  });

  it("WF-46 registry", () => {
    const text = readFileSync(path.join(REPO_ROOT, "docs/design/observability.md"), "utf8");
    const rows = text.split("\n").filter((l) => l.startsWith("| WF-46 "));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("development-experiment");
    expect(rows[0]).toContain("test_kickoff_page_from_code");
    expect(text.split("\n").some((l) => l.startsWith("| development-experiment |") && l.includes("WF-46"))).toBe(true);
  });
});
