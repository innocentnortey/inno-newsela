// NL-23 (risk::security) FROZEN: Docker-backed checks. Skipped unless LS_DOCKER_TESTS=1.
// On this VPS: LS_DOCKER_TESTS=1 DOCKER_CMD="sudo -n docker" npx vitest run tests/platform/docker-images.docker.test.ts
// AC-1 (build, non-root), AC-2, AC-3 (marker), AC-5 (compose config), AC-7 (required vars).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DOCKER = (process.env["DOCKER_CMD"] ?? "docker").split(" ").filter(Boolean);
const MARKER = "sk-ant-TESTMARKER-9f3";
const REQUIRED = ["COLLAB_INTERNAL_TOKEN", "AUDIT_HASH_SALT", "DATABASE_URL"] as const;

function docker(args: string[], env: Record<string, string> = {}, unset: string[] = []) {
  const clean: Record<string, string | undefined> = { ...process.env, ...env };
  for (const k of unset) delete clean[k];
  const [bin, ...pre] = DOCKER;
  let argv = [...pre, ...args];
  if (bin === "sudo") {
    // sudo drops the caller's environment: pass the variables explicitly through env(1).
    const i = pre.indexOf("docker");
    argv = [...pre.slice(0, i), "env", ...Object.entries(env).map(([k, v]) => `${k}=${v}`), ...pre.slice(i), ...args];
  }
  const r = spawnSync(bin!, argv, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: clean as NodeJS.ProcessEnv });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? ""), stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}
const base_env = (): Record<string, string> => ({
  COLLAB_INTERNAL_TOKEN: "tok-unit-test-1", AUDIT_HASH_SALT: "salt-unit-test-1",
  DATABASE_URL: "postgres://u:pw-unit-test-1@postgres:5432/ls", MIGRATE_DATABASE_URL: "postgres://o:pw-owner-test-1@postgres:5432/ls",
});
const build = (): void => {
  for (const [f, t] of [["Dockerfile.web", "ls-web"], ["Dockerfile.node", "ls-node"]] as const) {
    const r = docker(["build", "-f", f, "-t", t, "."]);
    expect(r.status, `build ${f}\n${r.out.slice(-1500)}`).toBe(0);
  }
};

describe.skipIf(process.env["LS_DOCKER_TESTS"] !== "1")("NL-23 docker", () => {
  const planted_dir = path.join(root, "docs/source/restricted");
  const planted = path.join(planted_dir, "PLANTED.txt");
  let made_dir = false;
  afterAll(() => {
    fs.rmSync(planted, { force: true });
    if (made_dir) fs.rmSync(planted_dir, { recursive: true, force: true });
  });

  it("test_images_build_and_non_root (AC-1, invariant)", () => {
    build();
    for (const t of ["ls-web", "ls-node"]) {
      const r = docker(["run", "--rm", "--entrypoint", "id", t, "-u"]);
      expect(r.status, `${t} id -u`).toBe(0);
      expect(Number(r.stdout.trim()), `${t} uid`).toBeGreaterThan(0);
    }
  }, 1_800_000);

  it("test_no_restricted_or_env_in_image (AC-2, negative; planted file)", () => {
    made_dir = !fs.existsSync(planted_dir);
    fs.mkdirSync(planted_dir, { recursive: true });
    fs.writeFileSync(planted, "synthetic planted marker, not real content\n");
    try {
      build();
    } finally {
      fs.rmSync(planted, { force: true });
      if (made_dir) fs.rmSync(planted_dir, { recursive: true, force: true });
      made_dir = false;
    }
    for (const t of ["ls-web", "ls-node"]) {
      const script =
        "test ! -e /app/docs/source/restricted && test ! -e /app/.env && test ! -e /app/.git && test ! -e /app/docs/source/restricted/PLANTED.txt";
      const r = docker(["run", "--rm", "--entrypoint", "sh", t, "-c", script]);
      expect(r.status, `${t}: restricted/.env/.git/planted file absent\n${r.out}`).toBe(0);
      const f = docker(["run", "--rm", "--entrypoint", "sh", t, "-c", "find / -name PLANTED.txt -not -path '/proc/*' 2>/dev/null | wc -l"]);
      expect(f.stdout.trim(), `${t}: find PLANTED.txt`).toBe("0");
    }
  }, 1_800_000);

  it("test_marker_absent_from_history_and_inspect (AC-3, negative)", () => {
    build();
    for (const t of ["ls-web", "ls-node"]) {
      // Run-time-only marker: passed with -e to a throwaway container, never to the build.
      docker(["run", "--rm", "-e", `ANTHROPIC_API_KEY=${MARKER}`, "--entrypoint", "true", t]);
      const h = docker(["history", "--no-trunc", t]);
      expect(h.status).toBe(0);
      expect(h.out).not.toContain("sk-ant");
      expect(h.out).not.toContain("TESTMARKER");
      const i = docker(["image", "inspect", t]);
      expect(i.status).toBe(0);
      expect(i.out).not.toContain("TESTMARKER");
      expect(i.out).not.toMatch(/"(ANTHROPIC_API_KEY|OPENROUTER_API_KEY|COLLAB_INTERNAL_TOKEN|AUDIT_HASH_SALT|DATABASE_URL)=/);
    }
  }, 1_800_000);

  it("test_compose_config_ports (AC-5, negative)", () => {
    const main = docker(["compose", "-f", "docker-compose.yml", "config", "--format", "json"], base_env());
    expect(main.status, main.out).toBe(0);
    const cfg = JSON.parse(main.stdout) as { services: Record<string, { ports?: unknown[] }> };
    expect(cfg.services["postgres"]).toBeDefined();
    expect(cfg.services["postgres"]!.ports ?? null).toBeNull();
    const both = docker(["compose", "-f", "docker-compose.yml", "-f", "docker-compose.test.yml", "config", "--format", "json"], base_env());
    expect(both.status, both.out).toBe(0);
    const merged = JSON.parse(both.stdout) as { services: Record<string, { ports?: Array<Record<string, unknown>> }> };
    const p = merged.services["postgres"]!.ports!;
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ host_ip: "127.0.0.1", published: "55440", target: 5432 });
  });

  it.each(REQUIRED)("test_required_var_unset_fails_naming_it: %s (AC-7, failure)", (name) => {
    const env = base_env();
    delete (env as Record<string, string | undefined>)[name];
    const r = docker(["compose", "-f", "docker-compose.yml", "config"], env, [name]);
    const out = r.out;
    expect(r.status).not.toBe(0);
    expect(out).toContain(name);
    for (const v of Object.entries(env)) if (v[0] !== name) expect(out).not.toContain(v[1]);
  });
});
