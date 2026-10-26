// NL-104 AC-12: WF-7 obligations on the real stack, one case per id.
import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { signInAs } from "../support/users";
import { getJson, METRICS_PATH, p95, walk } from "./helpers";
import { cleanupGlobal, seedAll, UNITS } from "./seed";

test.describe.configure({ mode: "serial" });
let ids: Awaited<ReturnType<typeof seedAll>>;
test.beforeAll(async () => { ids = await seedAll(); });
test.afterAll(async () => { await cleanupGlobal(ids); });

const ROOT = resolve(__dirname, "../../../../..");

test("wf-7-obligations: R-54 roles read on the API; anonymous is refused; unknown unit is NOT_FOUND", async ({ page, request }) => {
  const anon = await request.get(`${getStack().baseURL}${METRICS_PATH(UNITS.main.unit_id)}`);
  expect(anon.status()).toBe(401);
  for (const u of ids.reviewers) { // reviewer, author, approver
    await page.context().clearCookies();
    await signInAs(page, u);
    expect((await getJson(page, METRICS_PATH(UNITS.main.unit_id))).status, u.role).toBe(200);
  }
  const missing = await getJson(page, METRICS_PATH("G7.U99"));
  expect(missing.status).toBe(404);
  expect(JSON.stringify(missing.body)).toContain("NOT_FOUND");
  await page.context().clearCookies();
  await page.goto(`/units/${UNITS.main.unit_key}/quality`);
  await expect(page).toHaveURL(/\/sign-in/);
});

test("wf-7-obligations: R-57 30 sequential reads of the 16-tile route, p95 under 300 ms", async ({ page }) => {
  await signInAs(page, ids.reviewers[0]!);
  const times: number[] = [];
  for (let i = 0; i < 30; i++) {
    const t0 = Date.now();
    const r = await getJson(page, METRICS_PATH(UNITS.main.unit_id));
    times.push(Date.now() - t0);
    expect(r.status).toBe(200);
    expect(r.body.quality.tiles).toHaveLength(16);
  }
  const p = p95(times);
  console.log(`R-57 metrics route p95 ms over 30 reads: ${p} [M] stub, single user, local; the 200-user number is NL-118/127`);
  expect(p).toBeLessThan(300);
});

test("wf-7-obligations: GR-9 restricted folder is git-ignored and no response carries it", async ({ page }) => {
  expect(spawnSync("git", ["check-ignore", "-q", "docs/source/restricted/x"], { cwd: ROOT }).status).toBe(0);
  await signInAs(page, ids.reviewers[0]!);
  for (const u of Object.values(UNITS)) {
    const r = await getJson(page, METRICS_PATH(u.unit_id));
    expect(JSON.stringify(r.body).toLowerCase()).not.toContain("restricted");
  }
});

test("wf-7-obligations: GR-13 synthetic users only; no email, student or teacher-of-record field in the response", async ({ page }) => {
  expect(await db().count("app_user", "email like 'con10-%' and synthetic = false")).toBe(0);
  await signInAs(page, ids.reviewers[0]!);
  for (const u of Object.values(UNITS)) {
    const r = await getJson(page, METRICS_PATH(u.unit_id));
    expect(JSON.stringify(r.body)).not.toMatch(/@/);
    walk(r.body, (o) => { for (const k of Object.keys(o)) expect(k).not.toMatch(/student|teacher_of_record|email/i); });
  }
});

test("wf-7-obligations: OBS-11 WF-7 row and getUnitMetrics registered; metrics.read is logged", async ({ page }) => {
  const doc = readFileSync(resolve(ROOT, "docs/design/observability.md"), "utf8");
  expect(doc).toContain("| WF-7 |");
  expect(doc).toContain("CON-10");
  expect(doc).toContain("unit metrics tiles"); // the WF-7 row names the entry point; the operation id getUnitMetrics is asserted in the log below
  await signInAs(page, ids.reviewers[0]!);
  const r = await getJson(page, METRICS_PATH(UNITS.main.unit_id));
  const rid = r.headers["x-request-id"];
  await expect.poll(() => getStack().logs().some((l) => l.includes('"metrics.read"') && l.includes(rid!) && l.includes('getUnitMetrics'))).toBe(true);
});
