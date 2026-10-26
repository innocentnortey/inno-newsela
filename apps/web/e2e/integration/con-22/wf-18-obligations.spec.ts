// NL-117 AC-12: obligations that ride on WF-18 (R-54, GR-9, GR-13, GR-16, OBS-11). One test per id.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, request as pwRequest } from "@playwright/test";
import { db } from "../support/db";
import { bannedIn } from "../support/copy-rules";
import { getStack } from "../support/real-stack";
import { as, COVERAGE_API, coverageUrl, getMatrix } from "./helpers";
import { seedThreeLessons } from "./seed";

test.setTimeout(240_000);
const ROOT = resolve(__dirname, "../../../../..");
const HERE = __dirname;
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

test("R-54: no cookie gets 401 UNAUTHENTICATED; author, reviewer and approver all read the matrix", async ({ page }) => {
  const fx = await seedThreeLessons();
  const anon = await pwRequest.newContext({ baseURL: getStack().baseURL });
  const res = await anon.get(COVERAGE_API(fx.unit.unit_id));
  expect(res.status()).toBe(401);
  expect(((await res.json()) as { error?: { code?: string } }).error?.code).toBe("UNAUTHENTICATED");
  await anon.dispose();
  for (const role of ["author", "reviewer", "approver"] as const) {
    await page.context().clearCookies();
    await as(page, role);
    expect((await page.request.get(COVERAGE_API(fx.unit.unit_id))).status(), role).toBe(200);
  }
});

test("GR-9: the restricted source folder is ignored, untracked and never referenced by con-22", async () => {
  expect(spawnSync("git", ["check-ignore", "-q", "docs/source/restricted/x"], { cwd: ROOT }).status).toBe(0);
  expect(spawnSync("git", ["ls-files", "docs/source/restricted"], { cwd: ROOT, encoding: "utf8" }).stdout.trim()).toBe("");
  const needle = ["docs", "source", "restricted"].join("/");
  for (const f of walk(HERE).filter((p) => !p.endsWith("wf-18-obligations.spec.ts"))) expect(readFileSync(f, "utf8"), f).not.toContain(needle);
});

test("GR-13: staff roles only and no student or teacher wording in the matrix", async ({ page }) => {
  const fx = await seedThreeLessons();
  await as(page, "reviewer");
  for (const r of await db().query<{ role: string }>("select distinct role from app_user")) expect(["author", "reviewer", "approver"]).toContain(r.role);
  expect(JSON.stringify(await getMatrix(page, fx.unit.unit_id))).not.toMatch(/student|teacher/i);
});

test("GR-16: the screen never frames the tool as replacing writers", async ({ page }) => {
  const fx = await seedThreeLessons();
  await as(page, "reviewer");
  await page.goto(coverageUrl(fx.unit.unit_key));
  await expect(page.locator("main table")).toBeVisible();
  const text = await page.locator("body").innerText();
  expect(bannedIn(text)).toEqual([]);
  expect(text).not.toMatch(/replac(e|es|ing) (the )?writers?/i);
});

test("OBS-11: the WF-18 row is registered and its verification test exists", async () => {
  const doc = readFileSync(join(ROOT, "docs/design/observability.md"), "utf8");
  expect(doc.split("\n").some((l) => l.startsWith("| WF-18 |"))).toBe(true);
  expect(existsSync(join(HERE, "coverage.spec.ts"))).toBe(true);
  expect(readFileSync(join(HERE, "coverage.spec.ts"), "utf8")).toContain("test_coverage_matrix_reads_links");
});
