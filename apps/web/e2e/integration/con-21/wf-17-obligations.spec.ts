// NL-97 AC-12: obligations that ride on WF-17 (R-54, GR-9, GR-13, CON-G1, OBS-1, OBS-2, OBS-7, OBS-11). One test per id.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, request as pwRequest } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { asRole, getSummary, runScenario, summaryApi } from "./helpers";

test.setTimeout(240_000);
const ROOT = resolve(__dirname, "../../../../..");
const HERE = __dirname;
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

test("R-54: no cookie gets 401 UNAUTHENTICATED; author, reviewer and approver all read the summary", async ({ page }) => {
  const { runId } = await runScenario(page, "repaired");
  const anon = await pwRequest.newContext({ baseURL: getStack().baseURL });
  const res = await anon.get(summaryApi(runId));
  expect(res.status()).toBe(401);
  expect(((await res.json()) as { error?: { code?: string } }).error?.code).toBe("UNAUTHENTICATED");
  await anon.dispose();
  for (const role of ["author", "reviewer", "approver"] as const) {
    await asRole(page, role);
    expect((await page.request.get(summaryApi(runId))).status(), role).toBe(200);
  }
});

test("GR-9: the restricted source folder is ignored, untracked and never referenced by con-21", async () => {
  expect(spawnSync("git", ["check-ignore", "-q", "docs/source/restricted/x"], { cwd: ROOT }).status).toBe(0);
  expect(spawnSync("git", ["ls-files", "docs/source/restricted"], { cwd: ROOT, encoding: "utf8" }).stdout.trim()).toBe("");
  const needle = ["docs", "source", "restricted"].join("/");
  for (const f of walk(HERE).filter((p) => !p.endsWith("wf-17-obligations.spec.ts"))) expect(readFileSync(f, "utf8"), f).not.toContain(needle);
});

test("GR-13: staff roles only and no student or teacher wording in the summary response", async ({ page }) => {
  const { runId } = await runScenario(page, "repaired");
  for (const r of await db().query<{ role: string }>("select distinct role from app_user")) expect(["author", "reviewer", "approver"]).toContain(r.role);
  expect(JSON.stringify(await getSummary(page, runId))).not.toMatch(/student|teacher/i);
});

test("CON-G1: the summary is a read: it needs a session, and a write method is refused (no write route exists here)", async ({ page, request }) => {
  const { runId } = await runScenario(page, "repaired");
  expect((await request.get(summaryApi(runId))).status()).toBe(401);
  const post = await page.request.post(summaryApi(runId), { data: {}, headers: { Origin: getStack().baseURL } });
  console.log(`POST on the summary route -> ${post.status()}`);
  expect([404, 405]).toContain(post.status());
});

test("OBS-1: the verification specs drive the real entry points and assert on stored rows", async () => {
  const cap = readFileSync(join(HERE, "capture.spec.ts"), "utf8");
  expect(cap).toContain("runScenario(page");
  expect(cap).toContain("summaryApi(");
  expect(cap).toContain("from eval_run");
  expect(readFileSync(join(HERE, "run-summary-totals.spec.ts"), "utf8")).toContain("oracleSummary(");
  expect(readFileSync(join(HERE, "helpers.ts"), "utf8")).toContain('"/api/runs"');
});

test("OBS-2: the run id is minted at run creation and sits on every job and call row", async ({ page }) => {
  const { runId } = await runScenario(page, "mixed");
  expect(runId).toMatch(/^run_[0-9A-Z]{26}$/);
  for (const t of ["lesson_job", "model_call", "spend_reservation"]) {
    expect(await db().count(t, "run_id is null"), `${t} rows without run_id`).toBe(0);
    expect(await db().count(t, "run_id=$1", [runId]), `${t} rows for the run`).toBeGreaterThan(0);
  }
  const [r] = await db().query<{ early: boolean }>("select r.created_at <= (select min(queued_at) from lesson_job where run_id=r.id) as early from run r where id=$1", [runId]);
  expect(r!.early).toBe(true);
});

test("OBS-7: no provider key, password or restricted text in the database dump or the logs", async ({ page }) => {
  const { user, runId } = await runScenario(page, "mixed");
  expect(runId).toBeTruthy();
  const dump = await db().dumpAll();
  expect(dump.length).toBeGreaterThan(5000);
  const logs = getStack().logs().join("\n");
  for (const [name, text] of [["database dump", dump], ["web logs", logs]] as const) {
    expect(text, `${name}: provider key`).not.toMatch(/sk-(ant-)?[A-Za-z0-9_-]{16,}/);
    expect(text, `${name}: plain password`).not.toContain(user.password);
    expect(text, `${name}: restricted path`).not.toContain(["docs", "source", "restricted"].join("/"));
  }
});

test("OBS-11: the WF-17 row is registered and its verification spec exists", async () => {
  const doc = readFileSync(join(ROOT, "docs/design/observability.md"), "utf8");
  expect(doc.split("\n").some((l) => l.startsWith("| WF-17 |"))).toBe(true);
  expect(existsSync(join(HERE, "capture.spec.ts"))).toBe(true);
});
