import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Role } from "../../src/lib/roles";
import { signInAs } from "../../src/test-utils/sign-in-as";
import {
  METRICS_N0,
  METRICS_N3,
  REVIEWER_NAMES,
  UNITS_RUNNING,
  makeBoard,
  makeRows,
  routeBoard,
  type RouteOpts,
} from "./board-fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const SHOTS = "e2e/__screenshots__/board";

async function open(page: Page, role: Role, opts: RouteOpts = {}, url = "/units/g6-u4/board") {
  await signInAs(page, role);
  const ctl = await routeBoard(page, opts);
  await page.goto(url);
  return ctl;
}
const table = (page: Page) => page.getByRole("table", { name: /Lessons in this unit/ });
const rowOf = (page: Page, title: string) => page.getByRole("row").filter({ has: page.getByRole("link", { name: title }) });
const emptyBoard = () => makeBoard({ rows: [], rollup: {} });

test("board states: loading", async ({ page }) => {
  let release!: () => void;
  const boardGate = new Promise<void>((r) => (release = r));
  await open(page, "reviewer", { boardGate });
  await expect(page.locator('[data-skeleton="rollup-cell"]')).toHaveCount(5);
  await expect(page.locator('[data-skeleton="tile"]')).toHaveCount(1);
  await expect(page.locator('[data-skeleton="row"]')).toHaveCount(8);
  release();
  await expect(table(page)).toBeVisible();
});

test("board states: success", async ({ page }) => {
  await open(page, "reviewer");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Unit 4 · The Lightning Thief");
  await expect(page.getByText("47 lessons", { exact: true })).toBeVisible();
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  for (const c of ["Units", "Grade 6", "Unit 4"]) await expect(crumbs).toContainText(c);
  await expect(page.getByRole("img", { name: "Draft 34, In review 6, Submitted 2, Approved 3, Failed 2" })).toBeVisible();
  const l4 = rowOf(page, "Lesson 4: The Lightning Thief, Chapter 1");
  const cells = l4.getByRole("cell");
  await expect(cells.nth(3)).toContainText("3");
  await expect(cells.nth(4)).toHaveText("1");
  await expect(cells.nth(2)).toContainText("Draft");
  await expect(cells.nth(6)).toContainText("Waits on Lesson 5's excerpt");
  await expect(page.getByRole("columnheader", { name: "Blocking" })).toHaveAttribute("aria-sort", "descending");
  await expect(page.getByText("31", { exact: true })).toBeVisible();
  await expect(page.getByText("median · n = 3")).toBeVisible();
  await expect(page.getByText("approved 3 of 47")).toBeVisible();
  await expect(page.getByText("No baseline yet (AQ-14). Measured with us as reviewers.")).toBeVisible();
  const links = page.getByRole("navigation", { name: "Related pages" });
  for (const l of ["Run summary", "Unit plan", "Coverage", "Unit quality", "Export"]) await expect(links.getByRole("link", { name: l })).toBeVisible();
});

test("board states: server order is kept", async ({ page }) => {
  await open(page, "reviewer");
  await expect(table(page)).toBeVisible();
  const shown = await table(page).locator("tbody tr td:first-child a").allTextContents();
  expect(shown).toEqual(makeRows().map((r) => r.title));
});

test("board states: dependency, send-back, judge, failed notes", async ({ page }) => {
  await open(page, "reviewer");
  await expect(rowOf(page, "Lesson 14: Maps and routes")).toContainText("Waits on Lesson 3's approval");
  await expect(rowOf(page, "Lesson 14: Maps and routes")).toContainText("Judge: no · provisional, not expert");
  await expect(rowOf(page, "Lesson 13: Alpha vocabulary")).toContainText("A lesson this depends on was reopened");
  await expect(rowOf(page, "Lesson 12: Argument writing")).toContainText("Content safety");
  await expect(rowOf(page, "Lesson 12: Argument writing")).toContainText("Changes requested by Approver (demo)");
  await expect(rowOf(page, "Lesson 9: Failed to generate")).toContainText("Generation failed");
});

test("board states: north-star empty", async ({ page }) => {
  await open(page, "reviewer", { metrics: METRICS_N0 });
  await expect(page.getByText("No approved lessons yet")).toBeVisible();
  await expect(page.getByText("approved 0 of 47")).toBeVisible();
  await expect(page.locator(".text-display")).toHaveCount(0);
});

test("board filter: radio", async ({ page }) => {
  await open(page, "reviewer");
  const group = page.getByRole("radiogroup", { name: "Filter lessons by state" });
  await expect(group.getByRole("radio", { name: "Changes requested" })).toHaveCount(0);
  await expect(group.getByRole("radio", { name: "Reopened" })).toHaveCount(0);
  await group.getByRole("radio", { name: "In review" }).click();
  await expect(page).toHaveURL(/\?state=in_review$/);
  await expect(table(page).locator("tbody tr")).toHaveCount(6);
  await expect(table(page).locator("tbody tr").filter({ hasText: "Draft" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /^Draft 34, In review 6/ })).toBeVisible();
});

test("board filter: roll-up cell", async ({ page }) => {
  await open(page, "reviewer");
  await page.getByRole("button", { name: /Submitted/ }).click();
  await expect(page.getByRole("button", { name: /Submitted/ })).toHaveAttribute("aria-pressed", "true");
  await expect(table(page).locator("tbody tr")).toHaveCount(2);
});

test("board filter: changes requested radio appears with data", async ({ page }) => {
  await open(page, "reviewer", { board: () => makeBoard({ rollup: { draft: 33, in_review: 6, submitted: 2, approved: 3, generation_failed: 2, changes_requested: 1 } }) });
  const group = page.getByRole("radiogroup", { name: "Filter lessons by state" });
  await expect(group.getByRole("radio", { name: "Changes requested" })).toBeVisible();
});

test("board filter: no rows", async ({ page }) => {
  await open(page, "reviewer", { board: (state) => (state ? makeBoard({ rows: [] }) : makeBoard()) });
  await page.getByRole("radiogroup", { name: "Filter lessons by state" }).getByRole("radio", { name: "In review" }).click();
  await expect(page.getByText("No lessons are In review.")).toBeVisible();
  await page.getByRole("button", { name: "Show all lessons" }).click();
  await expect(table(page).locator("tbody tr")).toHaveCount(47);
});

test("board empty: author", async ({ page }) => {
  await open(page, "author", { board: emptyBoard });
  await expect(page.getByText("No lessons generated for this unit yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to the validation report" })).toHaveAttribute("href", "/units/g6-u4/outlines/2");
  await expect(page.getByText("Reviewer minutes per approved lesson")).toHaveCount(0);
});

test("board empty: reviewer", async ({ page }) => {
  await open(page, "reviewer", { board: emptyBoard });
  await expect(page.getByRole("link", { name: "See the latest run" })).toHaveAttribute("href", "/units/g6-u4/runs/run-0001");
});

test("board partial: run banner", async ({ page }) => {
  const rows = makeRows().slice(0, 12);
  await open(page, "reviewer", { units: UNITS_RUNNING, board: () => makeBoard({ rows, rollup: { draft: 12 } }) });
  await expect(page.getByText("Run in progress: 12 of 47 lessons ready.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Watch progress" })).toHaveAttribute("href", "/units/g6-u4/runs/run-0001");
});

test("board errors: board", async ({ page }) => {
  const ctl = await open(page, "reviewer", { boardStatus: 500 });
  await expect(page.getByText("Couldn't load the unit board. Check your connection and try again.")).toBeVisible();
  ctl.failBoard = null;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(table(page)).toBeVisible();
});

test("board errors: tile", async ({ page }) => {
  await open(page, "reviewer", { metrics: "error" });
  await expect(table(page)).toBeVisible();
  await expect(page.getByRole("img", { name: /^Draft 34/ })).toBeVisible();
  await expect(page.getByText("Couldn't load the north-star numbers.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

async function goStale(page: Page, role: Role) {
  const ctl = await open(page, role);
  await expect(table(page)).toBeVisible();
  return ctl;
}

test("board stale: banner keeps rows and focus", async ({ page }) => {
  test.setTimeout(60_000);
  const ctl = await goStale(page, "reviewer");
  const first = table(page).locator("tbody tr td:first-child a").first();
  await first.focus();
  ctl.failBoard = 503;
  await expect(page.getByText(/Live updates paused/)).toBeVisible({ timeout: 25_000 });
  await expect(table(page).locator("tbody tr")).toHaveCount(47);
  await expect(first).toBeFocused();
});

test("board routing: reviewer", async ({ page }) => {
  await open(page, "reviewer");
  const link = page.getByRole("link", { name: "Lesson 4: The Lightning Thief, Chapter 1" });
  await expect(link).toHaveAttribute("href", "/units/g6-u4/lessons/L4");
  await link.click();
  await page.waitForURL(/\/units\/g6-u4\/lessons\/L4$/);
});

test("board routing: approver", async ({ page }) => {
  await open(page, "approver");
  const l5 = page.getByRole("link", { name: "Lesson 5: Chapter 2 excerpt" });
  await expect(l5).toHaveAttribute("href", "/units/g6-u4/lessons/L5/approve");
  await expect(page.getByRole("link", { name: "Lesson 4: The Lightning Thief, Chapter 1" })).toHaveAttribute("href", /\/lessons\/L4$/);
  await l5.click();
  await page.waitForURL(/\/units\/g6-u4\/lessons\/L5\/approve$/);
});

test("board routing: author retry", async ({ page }) => {
  await open(page, "author");
  await expect(rowOf(page, "Lesson 9: Failed to generate").getByRole("link", { name: "Retry" })).toHaveAttribute("href", "/units/g6-u4/runs/run-0001");
});

test("board routing: reviewer has no retry", async ({ page }) => {
  await open(page, "reviewer");
  await expect(table(page)).toBeVisible();
  await expect(page.getByRole("link", { name: "Retry" })).toHaveCount(0);
});

test("board gr15: no minutes next to a reviewer name", async ({ page }) => {
  await open(page, "approver");
  await expect(table(page)).toBeVisible();
  const rows = await table(page).locator("tr").allTextContents();
  for (const t of rows) expect(t).not.toMatch(/\d+\s*min/i);
  for (const name of REVIEWER_NAMES) {
    // The tile's "min" is outside the table; compare the row (or, outside a row, the element) that holds the name.
    const holders = await page.getByText(name).evaluateAll((els) => els.map((e) => (e.closest("tr") ?? e).textContent ?? ""));
    expect(holders.length).toBeGreaterThan(0);
    for (const t of holders) expect(t).not.toMatch(/\bmin(utes)?\b/i);
  }
  await expect(page.getByText(/\brank/i)).toHaveCount(0);
});

type Scenario = { id: string; opts: RouteOpts; role?: Role; ready: (p: Page) => Promise<void> };
const SCENARIOS: Scenario[] = [
  { id: "main", opts: {}, ready: (p) => expect(table(p)).toBeVisible() },
  { id: "loading", opts: {}, ready: async (p) => { await expect(p.locator('[data-skeleton="row"]')).toHaveCount(8); } },
  { id: "northstar0", opts: { metrics: METRICS_N0 }, ready: (p) => expect(p.getByText("No approved lessons yet")).toBeVisible() },
  { id: "firstuse", opts: { board: emptyBoard }, role: "author", ready: (p) => expect(p.getByText("No lessons generated for this unit yet.")).toBeVisible() },
  { id: "norows", opts: { board: (s) => (s ? makeBoard({ rows: [] }) : makeBoard()) }, ready: (p) => expect(table(p)).toBeVisible() },
  { id: "runbanner", opts: { units: UNITS_RUNNING }, ready: (p) => expect(p.getByText(/Run in progress/)).toBeVisible() },
  { id: "paused", opts: {}, ready: (p) => expect(table(p)).toBeVisible() },
  { id: "boardfail", opts: { boardStatus: 500 }, ready: (p) => expect(p.getByText(/Couldn't load the unit board/)).toBeVisible() },
  { id: "tilefail", opts: { metrics: "error" }, ready: (p) => expect(p.getByText("Couldn't load the north-star numbers.")).toBeVisible() },
];

for (const sc of SCENARIOS) {
  for (const [w, h] of [[1280, 900], [390, 844]] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`board a11y ${sc.id} ${w} ${theme} @axe`, async ({ page }) => {
        test.setTimeout(60_000);
        await page.setViewportSize({ width: w, height: h });
        let release: (() => void) | undefined;
        const opts = { ...sc.opts };
        if (sc.id === "loading") opts.boardGate = new Promise<void>((r) => (release = r));
        const ctl = await open(page, sc.role ?? "reviewer", opts);
        await sc.ready(page);
        if (sc.id === "norows") {
          await page.getByRole("radiogroup", { name: "Filter lessons by state" }).getByRole("radio", { name: "In review" }).click();
          await expect(page.getByText("No lessons are In review.")).toBeVisible();
        }
        if (sc.id === "paused") {
          ctl.failBoard = 503;
          await expect(page.getByText(/Live updates paused/)).toBeVisible({ timeout: 25_000 });
        }
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.evaluate(() => document.fonts.ready);
        const res = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        console.log(`axe ${sc.id} ${w}x ${theme}: ${bad.length} serious/critical`);
        await page.screenshot({ path: `${SHOTS}/board-${sc.id}-${w}-${theme}.png`, fullPage: true });
        release?.();
        expect(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
      });
    }
  }
}

test("no outline empty state", async ({ page }) => {
  await signInAs(page, "reviewer");
  await routeBoard(page);
  await page.route(/\/units\/[^/]+\/board(\?.*)?$/, (route) => {
    if (route.request().method() !== "GET" || new URL(route.request().url()).port !== "4010") return route.fallback();
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*", "x-request-id": "req-test", "access-control-expose-headers": "x-request-id" },
      body: JSON.stringify({ error: { code: "NOT_FOUND", message: "There is no unit", details: {} } }),
    });
  });
  await page.goto("/units/g6-u4/board");
  await expect(page.getByText("No lessons generated for this unit yet.")).toBeVisible();
  await expect(page.getByText("Lessons appear here as a run drafts them.")).toBeVisible();
  await expect(page.getByText(/There is no unit/)).toHaveCount(0);
  await expect(page.getByText("Reviewer minutes per approved lesson")).toHaveCount(0);
});
