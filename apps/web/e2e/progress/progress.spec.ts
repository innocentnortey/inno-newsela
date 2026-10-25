import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { apiGlob, signInAs } from "../../src/test-utils/sign-in-as";
import {
  progress,
  RUN_URL,
  serveProgress,
  serveSummary,
  serveThenFail,
  tile,
  type RunProgress,
} from "./fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const SHOTS = "e2e/__screenshots__/progress";

const runningTiles = () => [
  tile(4, "ready"),
  tile(5, "drafting"),
  tile(6, "queued"),
  tile(7, "queued"),
];
const failedTiles = () => [
  tile(1, "ready"),
  tile(2, "failed", {
    repair_used: true,
    failure_reasons: [
      { check: "check_failed", message: "Look Back is 3 minutes (needs 5)" },
    ],
  }),
  tile(3, "failed", {
    truncation_retry_used: true,
    failure_reasons: [{ check: "truncated", message: "Output cut off" }],
  }),
];

async function open(
  page: Page,
  seq: RunProgress[],
  opts: { calls?: number; role?: "author" | "approver" } = {},
) {
  await signInAs(page, opts.role ?? "author");
  await serveSummary(page, opts.calls ?? 0);
  const served = await serveProgress(page, seq);
  await page.goto(RUN_URL);
  return served;
}

test('running: tiles update in place and only "Lesson 4 is ready" is announced', async ({
  page,
}) => {
  const first = progress("running", [
    tile(4, "drafting"),
    tile(5, "queued"),
    tile(6, "queued"),
  ]);
  const second = progress("running", [
    tile(4, "ready"),
    tile(5, "queued"),
    tile(6, "queued"),
  ]);
  const served = await open(page, [first, second]);
  const li = page.locator("li", { hasText: "Lesson 4" });
  await expect(li).toContainText("Drafting");
  const handle = await li.elementHandle();
  await expect(li).toContainText("Ready", { timeout: 6000 });
  const visibleAt = Date.now();
  const servedSecond = served.servedAt()[1]!;
  console.log(`running change visible in ${visibleAt - servedSecond}ms`);
  expect(visibleAt - servedSecond).toBeLessThanOrEqual(3000);
  expect(await handle!.evaluate((el) => el.isConnected)).toBe(true);
  await expect(page.getByTestId("announcer")).toHaveText("Lesson 4 is ready");
});

test("state partial", async ({ page }) => {
  await open(page, [progress("partial", failedTiles())]);
  await expect(
    page.getByText("Run partial: 2 of 3 failed. Ready lessons are reviewable."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry failed" }),
  ).toBeVisible();
});

test("state capped", async ({ page }) => {
  await open(page, [
    progress("capped", failedTiles(), { capped_by: "run_cap" }),
  ]);
  await expect(
    page.getByText(
      "Run capped: the next call would pass the $5.00 cap. No new calls start. To finish, start a new run on the unfinished rows.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start a new run on the unfinished rows" }),
  ).toHaveAttribute("href", /start_run=unfinished_of_run&run_id=run-0001/);
});

test("state paused", async ({ page }) => {
  await open(page, [
    progress("paused", failedTiles(), {
      paused_reason: { check: "check_failed", lesson_ids: ["G6.U4.L2"] },
    }),
  ]);
  await expect(
    page.getByText(
      "Run paused: 1 lessons in a row failed the same check (Look Back is 3 minutes (needs 5)). Read the failures, then resume.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
});

test("state cancelled", async ({ page }) => {
  await open(page, [progress("cancelled", failedTiles())]);
  await expect(
    page.getByText("Run cancelled. Calls in flight finished and were stored."),
  ).toBeVisible();
});

test("state restart", async ({ page }) => {
  await open(page, [progress("running", runningTiles())], { calls: 1 });
  await expect(
    page.getByText("The run resumed after a restart. 1 call lost in flight."),
  ).toBeVisible();
});

test("state complete", async ({ page }) => {
  await open(page, [
    progress("complete", [tile(1, "ready"), tile(2, "ready")]),
  ]);
  await expect(page.getByText("Run complete: 2 of 2 ready.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open the board" }),
  ).toHaveAttribute("href", "/units/g6-u4/board");
});

test("failed tile reasons and cost text", async ({ page }) => {
  await open(page, [progress("partial", failedTiles())]);
  await expect(
    page.getByText("Failed after 1 repair: Look Back is 3 minutes (needs 5)"),
  ).toBeVisible();
  await expect(
    page.getByText("Failed: truncated (retried once with a bigger limit)"),
  ).toBeVisible();
  await expect(page.getByRole("meter")).toHaveAttribute(
    "aria-valuetext",
    "$1.84 of $5.00 cap",
  );
  await expect(
    page.getByText("$1.84 of $5.00 cap", { exact: true }),
  ).toBeVisible();
});

test("cancel asks inline", async ({ page }) => {
  const posts: string[] = [];
  await signInAs(page, "author");
  await serveSummary(page, 0);
  const served = await serveProgress(page, [
    progress("running", runningTiles()),
  ]);
  await page.route(apiGlob("/runs/*/actions"), (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    posts.push(route.request().postData() ?? "");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ run_id: "run-0001", state: "cancelled" }),
    });
  });
  await page.goto(RUN_URL);
  await page.getByRole("button", { name: "Cancel run" }).click();
  await expect(
    page.getByText(
      "Cancel the run? Calls in flight will finish; no new calls start.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keep running" }),
  ).toBeFocused();
  expect(posts).toHaveLength(0);
  await page.getByRole("button", { name: "Keep running" }).click();
  await expect(page.getByText(/Cancel the run\?/)).toBeHidden();
  await page.getByRole("button", { name: "Cancel run" }).click();
  const before = served.hits();
  await page
    .getByRole("group", { name: "Confirm cancel" })
    .getByRole("button", { name: "Cancel run" })
    .click();
  await expect.poll(() => posts.length).toBe(1);
  expect(JSON.parse(posts[0]!)).toEqual({ action: "cancel" });
  await expect.poll(() => served.hits()).toBeGreaterThan(before);
});

test("control failure", async ({ page }) => {
  await respondWithError(page, "controlRun", "SERVICE_BUSY");
  await open(page, [progress("partial", failedTiles())]);
  await page.getByRole("button", { name: "Retry failed" }).click();
  await expect(
    page.getByText("Couldn't retry. Nothing changed. Try again."),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Lessons in this run" }),
  ).toBeVisible();
});

test("invalid transition rereads progress", async ({ page }) => {
  await respondWithError(page, "controlRun", "INVALID_TRANSITION");
  const served = await open(page, [progress("partial", failedTiles())]);
  await expect(
    page.getByRole("button", { name: "Retry failed" }),
  ).toBeVisible();
  const before = served.hits();
  await page.getByRole("button", { name: "Retry failed" }).click();
  await expect(
    page.getByText("Couldn't retry. Nothing changed. Try again."),
  ).toBeVisible();
  await expect
    .poll(() => served.hits(), { timeout: 1000 })
    .toBeGreaterThan(before);
});

test("stale banner keeps tiles", async ({ page }) => {
  await signInAs(page, "author");
  await serveSummary(page, 0);
  await serveThenFail(page, progress("running", runningTiles()));
  await page.goto(RUN_URL);
  await expect(
    page.getByText(
      /Live updates paused\. Showing the run as of \d\d:\d\d\. Retrying…/,
    ),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("list", { name: "Lessons in this run" }),
  ).toBeVisible();
  await expect(page.getByText("Lesson 5 (synthetic)")).toBeVisible();
});

test("approver sees no controls", async ({ page }) => {
  let posts = 0;
  await page.route(apiGlob("/runs/*/actions"), (route) => {
    if (route.request().method() === "POST") posts += 1;
    return route.fallback();
  });
  await open(
    page,
    [
      progress("paused", failedTiles(), {
        paused_reason: { check: "check_failed", lesson_ids: ["G6.U4.L2"] },
      }),
    ],
    { role: "approver" },
  );
  await expect(page.getByText("Only authors can control a run")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Cancel run|Retry failed|Resume/ }),
  ).toHaveCount(0);
  expect(posts).toBe(0);
});

type AxeState =
  | "main"
  | "partial"
  | "paused"
  | "cancelled"
  | "complete"
  | "stale"
  | "error"
  | "cantload";
async function arrange(page: Page, state: AxeState) {
  await signInAs(page, "author");
  await serveSummary(page, 0);
  switch (state) {
    case "main":
      await serveProgress(page, [progress("running", runningTiles())]);
      break;
    case "partial":
    case "error":
      if (state === "error")
        await respondWithError(page, "controlRun", "SERVICE_BUSY");
      await serveProgress(page, [progress("partial", failedTiles())]);
      break;
    case "paused":
      await serveProgress(page, [
        progress("paused", failedTiles(), {
          paused_reason: { check: "check_failed", lesson_ids: ["G6.U4.L2"] },
        }),
      ]);
      break;
    case "cancelled":
      await serveProgress(page, [progress("cancelled", failedTiles())]);
      break;
    case "complete":
      await serveProgress(page, [
        progress("complete", [tile(1, "ready"), tile(2, "ready")]),
      ]);
      break;
    case "stale":
      await serveThenFail(page, progress("running", runningTiles()));
      break;
    case "cantload":
      await serveProgress(page, "always-fail");
      break;
  }
  await page.goto(RUN_URL);
  if (state === "error") {
    await page.getByRole("button", { name: "Retry failed" }).click();
    await expect(
      page.getByText("Couldn't retry. Nothing changed. Try again."),
    ).toBeVisible();
  } else if (state === "stale") {
    await expect(page.getByText(/Live updates paused/)).toBeVisible({
      timeout: 20000,
    });
  } else if (state === "cantload") {
    await expect(page.getByText(/Couldn't load run progress/)).toBeVisible();
  } else {
    await expect(
      page.getByRole("list", { name: "Lessons in this run" }),
    ).toBeVisible();
  }
}

const STATES: AxeState[] = [
  "main",
  "partial",
  "paused",
  "cancelled",
  "complete",
  "stale",
  "error",
  "cantload",
];
for (const state of STATES) {
  for (const [w, h] of [
    [1280, 900],
    [390, 844],
  ] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`progress ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await arrange(page, state);
        await page.evaluate(
          (t) => document.documentElement.setAttribute("data-theme", t),
          theme,
        );
        await page.evaluate(() => document.fonts.ready);
        const results = await new AxeBuilder({ page: page as AxePage })
          .withTags(TAGS)
          .analyze();
        const bad = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        console.log(
          `axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`,
        );
        if (state === "main" || state === "error") {
          await page.screenshot({
            path: `${SHOTS}/progress-${state}-${w}-${theme}.png`,
            fullPage: true,
          });
        }
        expect(
          bad,
          JSON.stringify(
            bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          ),
        ).toEqual([]);
      });
    }
  }
}
