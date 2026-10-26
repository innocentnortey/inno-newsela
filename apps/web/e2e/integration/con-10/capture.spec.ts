// NL-104 AC-7: the metrics read is logged with request_id, duration and unit_id; each tile names its stored tables.
// The 200-user timing is NL-118/NL-127; this is a single-user smoke.
import { expect, test } from "@playwright/test";
import { SOURCES } from "../../../src/server/read-models/unit-quality";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { signInAs } from "../support/users";
import { getJson, METRICS_PATH, p95, QUALITY_URL } from "./helpers";
import { cleanupGlobal, seedAll, UNITS } from "./seed";

test.describe.configure({ mode: "serial" });
let ids: Awaited<ReturnType<typeof seedAll>>;
test.beforeAll(async () => { ids = await seedAll(); });
test.afterAll(async () => { await cleanupGlobal(ids); });

interface Line { [k: string]: unknown; extra?: { operation_id?: string; unit_id?: string } }
const parse = (lines: string[]): Line[] => lines.flatMap((l) => { try { return [JSON.parse(l) as Line]; } catch { return []; } });

test("capture: metrics.read and route.done carry request_id, duration_ms and unit_id", async ({ page }) => {
  await signInAs(page, ids.reviewers[0]!);
  for (let i = 0; i < 3; i++) await page.goto(QUALITY_URL(UNITS.main.unit_key));
  const rids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await getJson(page, METRICS_PATH(UNITS.main.unit_id));
    expect(r.status).toBe(200);
    rids.push(r.headers["x-request-id"]!);
  }
  expect(rids.every(Boolean)).toBe(true);
  await expect.poll(() => parse(getStack().logs()).some((l) => l["event"] === "metrics.read" && l["request_id"] === rids[2])).toBe(true);
  const lines = parse(getStack().logs());
  for (const rid of rids) {
    const read = lines.find((l) => l["event"] === "metrics.read" && l["request_id"] === rid);
    expect(read, "metrics.read line").toBeTruthy();
    expect(typeof read!["duration_ms"]).toBe("number");
    expect(read!.extra?.unit_id).toBe("G7.U1");
    const done = lines.find((l) => l["event"] === "route.done" && l["request_id"] === rid);
    expect(done?.extra?.operation_id).toBe("getUnitMetrics");
  }
});

test("capture: each tile names stored tables that exist", async () => {
  const have = new Set((await db().query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public'")).map((r) => r.table_name));
  const tileIds = Object.keys(SOURCES);
  expect(tileIds).toHaveLength(16);
  for (const id of tileIds) {
    expect(SOURCES[id]!.length, id).toBeGreaterThan(0);
    for (const t of SOURCES[id]!) expect(have.has(t), `${id} names ${t}`).toBe(true);
  }
});

test("capture: single-user smoke, 20 first loads timed (no threshold; 200 users is NL-118/NL-127)", async ({ browser }) => {
  const seedPage = await browser.newPage();
  await signInAs(seedPage, ids.reviewers[0]!);
  const storage = await seedPage.context().storageState();
  await seedPage.close();
  const times: number[] = [];
  for (let i = 0; i < 20; i++) {
    const ctx = await browser.newContext({ storageState: storage, baseURL: getStack().baseURL });
    const p = await ctx.newPage();
    const t0 = Date.now();
    await p.goto(QUALITY_URL(UNITS.main.unit_key));
    await expect(p.locator("main li").first()).toBeVisible();
    times.push(Date.now() - t0);
    await ctx.close();
  }
  expect(times).toHaveLength(20);
  console.log("quality first load p95 ms:", p95(times));
  const d = parse(getStack().logs()).filter((l) => l["event"] === "metrics.read" && typeof l["duration_ms"] === "number").map((l) => l["duration_ms"] as number);
  console.log(`metrics.read duration_ms p95 (${d.length} log lines):`, p95(d));
});
