// NL-99 shared checks for the two obligation files (kept out of the specs so each case stays short).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect } from "@playwright/test";

export const ROOT = resolve(__dirname, "../../../../..");
export const WEB = resolve(ROOT, "apps/web");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function checkRestrictedFolderRule(): void {
  const needle = ["docs", "source", "restricted"].join("/");
  expect(spawnSync("git", ["check-ignore", "-q", `${needle}/x`], { cwd: ROOT }).status).toBe(0);
  expect(spawnSync("git", ["ls-files", needle], { cwd: ROOT, encoding: "utf8" }).stdout.trim()).toBe("");
  for (const f of walk(join(WEB, "e2e/integration/con-20")).filter((p) => p.endsWith(".ts"))) {
    expect(readFileSync(f, "utf8"), f).not.toContain(needle);
  }
}

export function observabilityRow(wf: string): string {
  const doc = readFileSync(join(ROOT, "docs/design/observability.md"), "utf8");
  const row = doc.split("\n").find((l) => l.startsWith(`| ${wf} |`));
  expect(row, `${wf} row`).toBeDefined();
  return row!;
}

export function checkRegistered(wf: string, token: string, specFile: string): void {
  expect(observabilityRow(wf)).toContain(token);
  expect(existsSync(join(WEB, "e2e/integration/con-20", specFile))).toBe(true);
}
