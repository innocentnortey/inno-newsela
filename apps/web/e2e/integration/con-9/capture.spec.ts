// NL-98 AC-8: the board and tile requests are logged with request_id and duration; 20 single-user first loads are timed.
// The 200-user timing is NL-118/NL-127 and is not claimed here.
import { expect, test } from "@playwright/test";
import { getStack } from "../support/real-stack";
import { signInAs } from "../support/users";
import { BOARD_URL, getJson, p95 } from "./helpers";
import { seedMainUnit } from "./seed";

interface Line { [k: string]: unknown; extra?: { operation_id?: string; unit_id?: string } }
const op = (l: Line) => l.extra?.operation_id;
const parse = (lines: string[]): Line[] => lines.flatMap((l) => { try { return [JSON.parse(l) as Line]; } catch { return []; } });

test("capture: route.done for getUnitBoard and getUnitMetrics carries request_id and duration_ms; the unit-scoped line carries unit_id", async ({ page }) => {
  const seeded = await seedMainUnit();
  await signInAs(page, seeded.reviewers[0]!);
  const board = await getJson(page, "/api/units/G6.U4/board");
  const metrics = await getJson(page, "/api/units/G6.U4/metrics");
  const rid = (h: Record<string, string>) => h["x-request-id"];
  expect(rid(board.headers)).toBeTruthy();
  await expect.poll(() => parse(getStack().logs()).some((l) => l["request_id"] === rid(metrics.headers) && op(l) === "getUnitMetrics" && l["event"] === "route.done")).toBe(true);
  const lines = parse(getStack().logs());
  for (const [opId, res] of [["getUnitBoard", board], ["getUnitMetrics", metrics]] as const) {
    const done = lines.find((l) => l["event"] === "route.done" && l.extra?.operation_id === opId && l["request_id"] === rid(res.headers));
    expect(done, `${opId} route.done line`).toBeTruthy();
    expect(typeof done!["duration_ms"], `${opId} duration_ms`).toBe("number");
    const scoped = lines.find((l) => l["request_id"] === rid(res.headers) && l.extra?.unit_id === "G6.U4" && typeof l["duration_ms"] === "number");
    expect(scoped, `${opId}: a log line with the same request_id and unit_id G6.U4`).toBeTruthy();
  }
});

test("capture: single-user smoke, 20 first loads of the 47-row board, p95 printed (no threshold; 200 users is NL-118/NL-127)", async ({ browser }) => {
  const seeded = await seedMainUnit();
  const seedPage = await browser.newPage();
  await signInAs(seedPage, seeded.reviewers[0]!);
  const storage = await seedPage.context().storageState();
  await seedPage.close();
  const times: number[] = [];
  for (let i = 0; i < 20; i++) {
    const ctx = await browser.newContext({ storageState: storage, baseURL: getStack().baseURL });
    const p = await ctx.newPage();
    const t0 = Date.now();
    await p.goto(BOARD_URL());
    await expect(p.locator("tbody tr")).toHaveCount(47);
    times.push(Date.now() - t0);
    await ctx.close();
  }
  expect(times).toHaveLength(20);
  console.log("board first load p95 ms:", p95(times));
  const durations = parse(getStack().logs()).filter((l) => l["event"] === "route.done" && op(l) === "getUnitBoard" && typeof l["duration_ms"] === "number").map((l) => l["duration_ms"] as number);
  console.log(`getUnitBoard duration_ms p95 (${durations.length} log lines):`, p95(durations));
});
