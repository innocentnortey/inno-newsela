// NL-23 (risk::security) FROZEN: static checks over the build files. No Docker daemon needed.
// AC-2 (no restricted/secret file in an image), AC-3 (no secret in a build artefact), AC-5 (Postgres unpublished).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f: string): string => fs.readFileSync(path.join(root, f), "utf8");
const DOCKERFILES = ["Dockerfile.web", "Dockerfile.node"];
const SECRET_FILES = ["Dockerfile.web", "Dockerfile.node", "docker-compose.yml", "render.yaml"];
type Compose = { services: Record<string, { ports?: unknown; environment?: Record<string, unknown> | string[] }> };
const compose = (f: string): Compose => parse(read(f)) as Compose;
const env_of = (svc: string): Record<string, unknown> => {
  const e = compose("docker-compose.yml").services[svc]?.environment;
  if (!e || Array.isArray(e)) throw new Error(`${svc}: environment must be mapping form`);
  return e;
};
const code_lines = (text: string): string[] => text.split("\n").filter((l) => !l.trim().startsWith("#"));

describe("NL-23 AC-2 [negative] restricted and secret files stay out of images", () => {
  it("test_dockerignore_excludes_restricted_and_secrets", () => {
    expect(fs.existsSync(path.join(root, ".dockerignore")), ".dockerignore exists").toBe(true);
    const lines = read(".dockerignore").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const has = (re: RegExp): boolean => lines.some((l) => re.test(l));
    expect(has(/^\/?\.git\/?$/), ".git").toBe(true);
    expect(has(/^\/?\.env(\*|\.\*)$/) || (has(/^\/?\.env$/) && has(/^\/?\.env\.\*$/)), ".env*").toBe(true);
    expect(has(/^(\*\*\/)?node_modules\/?$/), "node_modules").toBe(true);
    expect(has(/^\/?evals\/local\/?(\*\*)?$/), "evals/local/").toBe(true);
    expect(has(/^\/?docs\/source\/restricted\/?(\*\*)?$/), "docs/source/restricted/ (GR-9)").toBe(true);
  });

  it("test_no_copy_of_restricted_or_env", () => {
    for (const f of DOCKERFILES) {
      expect(fs.existsSync(path.join(root, f)), `${f} exists`).toBe(true);
      const copies = code_lines(read(f)).filter((l) => /^\s*(COPY|ADD)\b/i.test(l));
      expect(copies.length, `${f} has COPY lines`).toBeGreaterThan(0);
      for (const l of copies) {
        expect(l, `${f}: ${l}`).not.toMatch(/restricted/i);
        expect(l, `${f}: ${l}`).not.toMatch(/(^|[\s/])\.env(\.|\s|$)/);
        expect(l, `${f}: ${l}`).not.toMatch(/(^|[\s/])\.git(\s|\/|$)/);
        expect(l, `${f}: ${l}`).not.toMatch(/evals\/local/);
      }
    }
  });
});

describe("NL-23 AC-3 [negative] no secret in any build artefact", () => {
  it("test_no_literal_secret_in_build_files (ticket regex)", () => {
    const re = /(ANTHROPIC|OPENROUTER|TOKEN|SALT|PASSWORD|SECRET)[A-Z_]*\s*[:=]\s*[^$ \n]/i;
    for (const f of SECRET_FILES) {
      expect(fs.existsSync(path.join(root, f)), `${f} exists`).toBe(true);
      const hits = code_lines(read(f)).filter((l) => re.test(l));
      expect(hits, `${f} literal secret-like lines`).toEqual([]);
    }
  });

  it("test_dockerfile_env_arg_only_build_id", () => {
    for (const f of DOCKERFILES) {
      expect(fs.existsSync(path.join(root, f)), `${f} exists`).toBe(true);
      const decl = code_lines(read(f)).filter((l) => /^\s*(ENV|ARG)\b/i.test(l));
      for (const l of decl) expect(l, `${f}: ${l}`).not.toMatch(/ANTHROPIC|OPENROUTER|TOKEN|SALT|PASSWORD|SECRET|KEY|DATABASE_URL/i);
    }
  });

  it("test_dockerfiles_run_non_root (last USER is not root)", () => {
    for (const f of DOCKERFILES) {
      expect(fs.existsSync(path.join(root, f)), `${f} exists`).toBe(true);
      const users = code_lines(read(f)).filter((l) => /^\s*USER\b/i.test(l));
      expect(users.length, `${f} sets USER`).toBeGreaterThan(0);
      const last = users[users.length - 1]!.replace(/^\s*USER\s+/i, "").trim();
      expect(last).not.toMatch(/^(root|0)(:|$)/);
    }
  });

  it("test_provider_keys_by_name_only", () => {
    for (const svc of ["web", "worker"]) {
      const e = env_of(svc);
      expect(e["ANTHROPIC_API_KEY"], `${svc} ANTHROPIC_API_KEY`).toBeNull();
      expect(e["OPENROUTER_API_KEY"], `${svc} OPENROUTER_API_KEY`).toBeNull();
      expect(String(e["MODEL_PROVIDER_MODE"])).toMatch(/^\$\{MODEL_PROVIDER_MODE:-stub\}$/);
    }
    expect(read("docker-compose.yml")).toMatch(/with-provider-env/);
  });

  it("test_required_vars_use_colon_question", () => {
    const text = read("docker-compose.yml");
    for (const v of ["COLLAB_INTERNAL_TOKEN", "AUDIT_HASH_SALT", "DATABASE_URL"]) {
      expect(text, v).toMatch(new RegExp(`\\$\\{${v}:\\?[^}]+\\}`));
    }
  });
});

describe("NL-23 AC-5 [negative] Postgres is not published outside the test override", () => {
  it("test_stack_declares_all_services (guards the check below against an empty file)", () => {
    const s = compose("docker-compose.yml").services;
    for (const n of ["postgres", "web", "worker", "collab"]) expect(s[n], `service ${n}`).toBeDefined();
  });

  it("test_postgres_unpublished_in_main_compose", () => {
    const s = compose("docker-compose.yml").services;
    expect(s["postgres"], "postgres service").toBeDefined();
    expect(s["postgres"]!.ports).toBeUndefined();
    expect(read("docker-compose.yml")).not.toMatch(/55440/);
  });

  it("test_only_test_override_binds_postgres_to_loopback_55440", () => {
    const t = compose("docker-compose.test.yml").services;
    expect(t["postgres"]!.ports).toEqual(["127.0.0.1:55440:5432"]);
    const main = compose("docker-compose.yml").services;
    for (const [name, svc] of Object.entries(main)) {
      if (name === "postgres") continue;
      const ports = (svc.ports ?? []) as unknown[];
      for (const p of ports) expect(String(p), `${name} must not publish 5432`).not.toMatch(/:5432\b|^5432/);
    }
  });
});
