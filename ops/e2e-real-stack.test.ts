// Tests of ops/e2e-real-stack.sh WITHOUT starting a stack: --print-fingerprint, --dry-run, the guards, and the run path against a
// temp git repo whose `npx` is a fake that only writes the files a Playwright run would (BUILD_ID and the JSON stats).
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL_REPO = path.resolve(here, "..");
const SCRIPT = path.join(here, "e2e-real-stack.sh");
const tmps: string[] = [];
const tmp = (): string => { const d = mkdtempSync(path.join(os.tmpdir(), "e2e-rs-")); tmps.push(d); return d; };
afterAll(() => { for (const d of tmps) rmSync(d, { recursive: true, force: true }); });

const sh = (cwd: string, cmd: string, args: string[]) => spawnSync(cmd, args, { cwd, encoding: "utf8" });
function git_repo(folders: string[] = ["con-1", "con-17", "con-2"]): string {
  const r = tmp();
  for (const f of folders) { mkdirSync(path.join(r, "apps/web/e2e/integration", f), { recursive: true }); writeFileSync(path.join(r, "apps/web/e2e/integration", f, ".keep"), ""); }
  mkdirSync(path.join(r, "scripts"), { recursive: true });
  copyFileSync(path.join(REAL_REPO, "scripts/link-node-modules.sh"), path.join(r, "scripts/link-node-modules.sh"));
  chmodSync(path.join(r, "scripts/link-node-modules.sh"), 0o755);
  writeFileSync(path.join(r, "tracked.txt"), "one\n");
  writeFileSync(path.join(r, ".gitignore"), "ignored.txt\n");
  for (const c of [["init", "-q"], ["add", "-A"], ["-c", "user.name=t", "-c", "user.email=t@example.test", "commit", "-qm", "init"]]) sh(r, "git", c);
  return r;
}
const run = (repo: string, args: string[], env: Record<string, string> = {}, extra: string[] = []) =>
  spawnSync("bash", [SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, E2E_REPO_ROOT: repo, E2E_LOCK_FILE: path.join(tmp(), "lock"), ...env, PATH: `${extra.join(":")}${extra.length ? ":" : ""}${process.env["PATH"]}` }, timeout: 120_000 });
const fp = (repo: string, env: Record<string, string> = {}) => JSON.parse(run(repo, ["--print-fingerprint"], env).stdout) as { head: string; dirty: boolean; dirty_hash: string; dirty_files: Array<{ status: string; path: string; sha256: string }> };

/** A fake `npx` first on PATH: records the env it got, writes BUILD_ID and the JSON stats, exits FAKE_RC (default 0). */
function fake_npx(log_dir: string, mutate_file?: string): string {
  const bin = tmp();
  const f = path.join(bin, "npx");
  writeFileSync(f, `#!/usr/bin/env bash
folder="\${@: -2:1}"; folder="\${folder##*/}"
env | grep -E '^(E2E_|ANTHROPIC|OPENROUTER|PLAYWRIGHT_JSON)' | sort > "${log_dir}/env-$folder.txt"
mkdir -p .next; [ -f .next/BUILD_ID ] || echo fake-build-id > .next/BUILD_ID
${mutate_file ? `echo changed >> "${mutate_file}"` : ":"}
echo '{"stats":{"expected":3,"unexpected":0,"flaky":0,"skipped":1}}' > "$PLAYWRIGHT_JSON_OUTPUT_NAME"
[ "$folder" = "con-2" ] && exit \${FAKE_RC_CON2:-0}
exit 0
`);
  chmodSync(f, 0o755);
  return bin;
}
const record = (out: string) => JSON.parse(readFileSync(path.join(out, "run-record.json"), "utf8"));

describe("e2e-real-stack.sh", () => {
  it("fingerprint_is_stable_and_sensitive", () => {
    const r = git_repo();
    const a = fp(r), b = fp(r);
    expect(a).toEqual(b);
    expect(a.dirty).toBe(false);
    expect(a.head).toBe(sh(r, "git", ["rev-parse", "HEAD"]).stdout.trim());
    writeFileSync(path.join(r, "tracked.txt"), "two\n");
    const c = fp(r);
    expect(c.dirty).toBe(true);
    expect(c.dirty_files.map((f) => f.path)).toContain("tracked.txt");
    expect(c.dirty_hash).not.toBe(a.dirty_hash);
    writeFileSync(path.join(r, "new.txt"), "x\n");
    const d = fp(r);
    expect(d.dirty_files.find((f) => f.path === "new.txt")?.status).toBe("?");
    expect(d.dirty_hash).not.toBe(c.dirty_hash);
    writeFileSync(path.join(r, "ignored.txt"), "x\n");
    expect(fp(r).dirty_hash).toBe(d.dirty_hash); // gitignored paths are not part of the candidate
    rmSync(path.join(r, "tracked.txt"));
    expect(fp(r).dirty_files.find((f) => f.path === "tracked.txt")).toMatchObject({ status: "D", sha256: "deleted" });
  });

  it("dry_run_writes_the_record", () => {
    const out = path.join(tmp(), "dry");
    const res = run(REAL_REPO, ["--dry-run", "--out", out]);
    expect(res.status, res.stderr).toBe(0);
    const rec = record(out);
    expect(rec.mode).toBe("dry-run");
    expect(rec.git.head).toBe(sh(REAL_REPO, "git", ["rev-parse", "HEAD"]).stdout.trim());
    expect(rec.git.dirty_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rec.env.E2E_COLLAB_INTERNAL_URL).toBe("http://127.0.0.1:4399/internal");
    expect(rec.env.E2E_ASSIST_TIMEOUT_MS).toBe("1500");
    expect(rec.claims.paid_real_model_generation).toBe(false);
    expect(rec.validity.status).toBe("not_run");
    const by = Object.fromEntries(rec.folders.map((f: { name: string; env_keys: string[] }) => [f.name, f.env_keys]));
    expect(by["con-17"]).toContain("E2E_COLLAB_INTERNAL_URL");
    expect(by["con-2"]).toEqual(["E2E_SHEETS_BASE_URL"]);
    expect(by["con-1"]).toEqual([]);
    expect(Object.keys(by).slice(0, 7)).toEqual(["con-1", "con-2", "con-3", "con-5", "con-6", "con-9", "con-10"]);
    expect(existsSync(path.join(out, "tree"))).toBe(false);
  });

  it("unknown_folder_refused", () => {
    const res = run(git_repo(), ["--only", "con-99", "--out", path.join(tmp(), "o")]);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("unknown folder");
  });

  it("busy_collab_port_refused", async () => {
    const srv = net.createServer();
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    const port = String((srv.address() as net.AddressInfo).port);
    try {
      const child = spawn("bash", [SCRIPT, "--only", "con-1", "--out", path.join(tmp(), "o")], { env: { ...process.env, E2E_REPO_ROOT: git_repo(), E2E_LOCK_FILE: path.join(tmp(), "lock"), E2E_COLLAB_PORT: port } });
      let err = "";
      child.stderr.on("data", (d) => (err += d));
      const code = await new Promise<number | null>((ok) => child.on("close", ok));
      expect(code).toBe(2);
      expect(err).toContain(port);
    } finally {
      srv.close();
    }
  });

  it("lock_refused_while_held", async () => {
    const lock = path.join(tmp(), "held.lock");
    const holder = spawn("flock", [lock, "sleep", "20"]);
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = spawnSync("bash", [SCRIPT, "--only", "con-1", "--out", path.join(tmp(), "o")], { encoding: "utf8", env: { ...process.env, E2E_REPO_ROOT: git_repo(), E2E_LOCK_FILE: lock } });
      expect(res.status).toBe(2);
      expect(res.stderr).toContain("holds the lock");
    } finally {
      holder.kill("SIGTERM");
    }
  });

  it("low_disk_refused", () => {
    const res = run(git_repo(), ["--only", "con-1", "--out", path.join(tmp(), "o")], { E2E_MIN_FREE_MB: "99999999" });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("MB free");
  });

  it("run_path_with_fake_playwright_gives_a_valid_record", () => {
    const repo = git_repo();
    writeFileSync(path.join(repo, "tracked.txt"), "dirty\n"); // the private tree must carry uncommitted state
    const logs = tmp();
    const out = path.join(tmp(), "run");
    const res = run(repo, ["--out", out, "--keep-tree"], {}, [fake_npx(logs)]);
    expect(res.status, res.stdout + res.stderr).toBe(0);
    const rec = record(out);
    expect(rec).toMatchObject({ mode: "run", validity: { status: "valid", reasons: [] }, claims: { paid_real_model_generation: false } });
    expect(rec.git.dirty).toBe(true);
    expect(rec.build.build_id).toBe("fake-build-id");
    expect(rec.build.build_id_unchanged_at_end).toBe(true);
    expect(rec.folders.map((f: { name: string; exit_code: number; expected: number; skipped: number }) => [f.name, f.exit_code, f.expected, f.skipped])).toEqual([["con-1", 0, 3, 1], ["con-2", 0, 3, 1], ["con-17", 0, 3, 1]]);
    expect(readFileSync(path.join(out, "tree/tracked.txt"), "utf8")).toBe("dirty\n");
    expect(existsSync(path.join(repo, "apps/web/.next"))).toBe(false); // the main checkout is never built
    const env17 = readFileSync(path.join(logs, "env-con-17.txt"), "utf8");
    expect(env17).toContain("E2E_COLLAB_INTERNAL_URL=http://127.0.0.1:4399/internal");
    expect(env17).toContain("E2E_ASSIST_STUB_FILE=");
    expect(readFileSync(path.join(logs, "env-con-1.txt"), "utf8")).not.toMatch(/E2E_COLLAB|E2E_SHEETS|E2E_ASSIST/);
    expect(readFileSync(path.join(logs, "env-con-2.txt"), "utf8")).toContain("E2E_SHEETS_BASE_URL=http://127.0.0.1:");
    expect(readFileSync(path.join(logs, "env-con-1.txt"), "utf8")).not.toMatch(/ANTHROPIC|OPENROUTER/);
  });

  it("failing_folder_is_a_result_not_invalid", () => {
    const out = path.join(tmp(), "run");
    const res = run(git_repo(), ["--out", out], { FAKE_RC_CON2: "1" }, [fake_npx(tmp())]);
    expect(res.status).toBe(1);
    const rec = record(out);
    expect(rec.validity.status).toBe("valid");
    expect(rec.folders.find((f: { name: string }) => f.name === "con-2").exit_code).toBe(1);
    expect(existsSync(path.join(out, "tree"))).toBe(false); // removed unless --keep-tree
  });

  it("only_subset_is_valid_subset_and_tree_change_invalidates", () => {
    const subset = path.join(tmp(), "a");
    expect(run(git_repo(), ["--only", "con-1", "--out", subset], {}, [fake_npx(tmp())]).status).toBe(0);
    expect(record(subset).validity.status).toBe("valid_subset");

    const repo = git_repo();
    const out = path.join(tmp(), "b");
    const res = run(repo, ["--only", "con-1", "--out", out], {}, [fake_npx(tmp(), path.join(repo, "tracked.txt"))]); // edits the checkout mid-run
    expect(res.status).toBe(3);
    expect(record(out).validity).toEqual({ status: "invalid", reasons: ["tree_changed_during_run"] });
  });
});
