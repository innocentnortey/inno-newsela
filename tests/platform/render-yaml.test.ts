// NL-23 AC-8: render.yaml is committed, shaped as planned, holds no literal secret, and nothing calls the Render API.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
type Svc = { name: string; dockerfilePath: string; autoDeploy: boolean; region: string; envVars: Array<Record<string, unknown>> };
type Doc = { services: Svc[]; databases: Array<{ name: string; region: string; ipAllowList: unknown[] }> };
const text = fs.readFileSync(path.join(root, "render.yaml"), "utf8");
const doc = parse(text) as Doc;

describe("NL-23 render.yaml", () => {
  it("test_render_yaml_shape", () => {
    expect(doc.services).toHaveLength(3);
    expect(doc.databases).toHaveLength(1);
    expect(doc.databases[0]!.ipAllowList).toEqual([]);
    expect(doc.databases[0]!.region).toBe("ohio");
    for (const s of doc.services) {
      expect(s.dockerfilePath, s.name).toMatch(/^\.\/Dockerfile\.(web|node)$/);
      expect(s.autoDeploy, s.name).toBe(false);
      expect(s.region, s.name).toBe("ohio");
      expect(s.envVars.some((e) => e["fromGroup"] === "ls-secrets"), s.name).toBe(true);
    }
  });

  it("test_render_yaml_no_literal_secret", () => {
    const re = /(ANTHROPIC|OPENROUTER|TOKEN|SALT|PASSWORD|SECRET|API_KEY)[A-Z_]*\s*[:=]\s*[^$ \n]/i;
    const hits = text.split("\n").filter((l) => !l.trim().startsWith("#") && re.test(l));
    expect(hits).toEqual([]);
    for (const s of doc.services) for (const e of s.envVars) if ("value" in e) expect(["stub", "1"]).toContain(String(e["value"]));
  });

  it("test_repo_never_calls_render_api", () => {
    const host = ["api", "render", "com"].join(".");
    const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean)
      .filter((f) => !f.startsWith("docs/") && !f.startsWith("ops/vps-run/") && !f.endsWith("package-lock.json"));
    const hits = files.filter((f) => fs.existsSync(path.join(root, f)) && fs.readFileSync(path.join(root, f), "utf8").includes(host));
    expect(hits).toEqual([]);
  });
});
