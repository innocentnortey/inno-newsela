// NL-125: shared checks for the three obligation files (one test per obligation id; the title is the id).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect } from "@playwright/test";
import { db } from "../../integration/support/db";

export const ROOT = resolve(__dirname, "../../../../..");
export const WEB = resolve(ROOT, "apps/web");
export const INTEGRITY = join(WEB, "e2e/integrity");
export const RESTRICTED = ["docs", "source", "restricted"].join("/");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** GR-9: the restricted folder is ignored and untracked, and nothing this ticket added mentions it. */
export function restrictedFolderRule(): void {
  expect(spawnSync("git", ["check-ignore", "-q", `${RESTRICTED}/x`], { cwd: ROOT }).status).toBe(0);
  expect(spawnSync("git", ["ls-files", RESTRICTED], { cwd: ROOT, encoding: "utf8" }).stdout.trim()).toBe("");
  const mine = [...walk(INTEGRITY).filter((p) => p.endsWith(".ts")), ...["s5.ts", "s5-support.ts", "s5-report.ts", "s5.test.ts"].map((f) => join(ROOT, "evals/src/suites", f))];
  for (const f of mine) expect(readFileSync(f, "utf8"), f).not.toContain(RESTRICTED);
}

/** GR-13: staff roles only, and no student or teacher-of-record column anywhere. */
export async function staffOnly(): Promise<void> {
  const roles = await db().query<{ role: string }>("select distinct role from app_user");
  for (const r of roles) expect(["author", "reviewer", "approver"]).toContain(r.role);
  const emails = await db().query<{ email: string }>("select email from app_user where email not like '%@example.test' and email not like '%@%.local'");
  expect(emails.filter((e) => /student|teacher/i.test(e.email))).toEqual([]);
  const cols = await db().query<{ column_name: string }>("select column_name from information_schema.columns where table_schema = 'public'");
  expect(cols.map((c) => c.column_name).filter((c) => /student|teacher_of_record|school_id|class_id/i.test(c))).toEqual([]);
}

export function observabilityRow(wf: string): string {
  const doc = readFileSync(join(ROOT, "docs/design/observability.md"), "utf8");
  const row = doc.split("\n").find((l) => l.startsWith(`| ${wf} |`));
  expect(row, `${wf} row`).toBeDefined();
  return row!;
}

/** OBS-11: the entry point has its WF-n row, the row names its capture test, and that test exists. */
export function registered(wf: string, token: string, file: string): void {
  expect(observabilityRow(wf)).toContain(token);
  expect(existsSync(file), file).toBe(true);
  expect(readFileSync(file, "utf8")).toContain(token);
}

export const BANNED = /replaces? (the )?(writers?|teachers?|editors?|humans?|experts?)|AI[- ]written|fully automated/i;
