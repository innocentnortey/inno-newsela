import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { components } from "../../src/lib/api-types";
import { mockOperation } from "../../src/test-utils/mock-operation";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { apiGlob, signInAs } from "../../src/test-utils/sign-in-as";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const SHOTS = "e2e/__screenshots__/start-run";
const PINNED = "v1 · locked rules + guidance v1 · pinned to this run";

const row = (row_number: number): components["schemas"]["ReportRow"] => ({
  row_number, kind: "lesson", lesson_id: null, level: "ok", findings: [], segments: [], eld: [], flags: [],
});
const report: components["schemas"]["ValidationReport"] = {
  outline_version_id: "G6.U4.ov1",
  version_number: 1,
  sha256: "a1" + "0".repeat(62) + "01",
  same_as_version: null,
  unit: { as_written: "U4", filenames_say: "U3", confirmed: false, confirmed_by: null },
  counts: {
    teaching_days: 47, lessons: 41, flex_days: 6, arc_headers: 7, total_rows: 1, errors: 5, errors_unconfirmed: 5,
    warnings: 31, unit_conflicts: 1, malformed_codes: 1, rows_with_nonexistent_code: 3, bad_filenames: 2, eld_mismatches: 7,
  },
  rows: [row(8), row(9), row(25)],
  unit_rules: [],
  runs_from_this_version: [],
  generate_allowed: false,
};

// The Prism example for listPromptVersions, served directly so these tests do not depend on a shared Prism port.
const prompts: components["schemas"]["PromptVersions"] = {
  current_prompt_version_id: "pv-locked1-guidance1",
  locked_layer: { version_id: "locked-1", text: "Synthetic locked rules." },
  guidance_versions: [{ version_id: "guidance-1", number: 1, author: "Author (demo)", created_at: "2026-10-25T14:00:00Z", reason: "First guidance", diff: "", pinned_by_runs: [] }],
};
async function stubPrompts(page: Page) {
  await page.route(apiGlob("/prompt-versions"), (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(prompts) }),
  );
}
async function stubReport(page: Page) {
  await page.route(apiGlob("/outline-versions/*/report"), (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(report),
    }),
  );
}
async function delayPrompt(page: Page, ms: number) {
  await page.route(apiGlob("/prompt-versions"), async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.fallback();
  });
}
async function prepare(page: Page, delayMs = 0) {
  await signInAs(page, "author");
  await stubPrompts(page);
  await stubReport(page);
  if (delayMs) await delayPrompt(page, delayMs);
}
async function open(page: Page, theme?: string) {
  await page.goto("/start-run-host");
  if (theme) await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
  await page.getByRole("button", { name: "Start run" }).click();
  const dialog = page.getByRole("dialog", { name: "Start a run" });
  await expect(dialog).toBeVisible();
  return dialog;
}
const submit = (dialog: ReturnType<Page["getByRole"]>) => dialog.getByRole("button", { name: "Start run" }).click();
function countPosts(page: Page) {
  const posts: { postData: () => string | null }[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/runs$/.test(new URL(r.url()).pathname)) posts.push(r);
  });
  return posts;
}

test("dialog opens on Scope, shows the skeleton then the pinned line, traps and returns focus", async ({ page }) => {
  await prepare(page, 800);
  const dialog = await open(page);
  await expect(page.getByTestId("prompt-skeleton")).toBeVisible();
  await expect(dialog.getByText(PINNED)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Chosen rows" })).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Start run" })).toBeFocused();
});

test("success sends one startRun and goes to the run", async ({ page }) => {
  await prepare(page);
  await mockOperation(page, "startRun");
  const posts = countPosts(page);
  const dialog = await open(page);
  await expect(dialog.getByText(PINNED)).toBeVisible();
  await dialog.getByRole("radio", { name: "Chosen rows" }).click();
  await dialog.getByLabel("Spend cap (dollars)").fill("5.00");
  await submit(dialog);
  await expect(page).toHaveURL(/\/units\/g6-u4\/runs\/run-0001$/);
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0]!.postData()!)).toEqual({
    outline_version_id: "G6.U4.ov1",
    mode: "run",
    scope: { kind: "rows", rows: [8, 9, 25] },
    prompt_version_id: "pv-locked1-guidance1",
    cap_usd: 5,
  });
});

const alertBox = (page: Page) => page.locator("div[tabindex='-1']:not([role=dialog])").filter({ has: page.getByRole("alert") });

test("server error VALIDATION_INCOMPLETE", async ({ page }) => {
  await prepare(page);
  await respondWithError(page, "startRun", "VALIDATION_INCOMPLETE", { errors_unconfirmed: 1 });
  const dialog = await open(page);
  await expect(dialog.getByText(PINNED)).toBeVisible();
  await submit(dialog);
  await expect(dialog.getByText("Confirm the report first: 1 error still to confirm.")).toBeVisible();
  await expect(alertBox(page)).toBeFocused();
  await dialog.getByRole("link", { name: "Show me the error" }).click();
  await expect(dialog).toBeHidden();
});

test("server error DAY_CAP_REACHED", async ({ page }) => {
  await prepare(page);
  await respondWithError(page, "startRun", "DAY_CAP_REACHED");
  const dialog = await open(page);
  await expect(dialog.getByText(PINNED)).toBeVisible();
  await submit(dialog);
  await expect(dialog.getByText("Daily spend cap reached. No run can start until tomorrow.")).toBeVisible();
  await expect(alertBox(page)).toBeFocused();
});

test("server error ROLE_FORBIDDEN", async ({ page }) => {
  await prepare(page);
  await respondWithError(page, "startRun", "ROLE_FORBIDDEN");
  const dialog = await open(page);
  await expect(dialog.getByText(PINNED)).toBeVisible();
  await submit(dialog);
  await expect(dialog.getByText("Only authors can start a run.")).toBeVisible();
  await expect(alertBox(page)).toBeFocused();
});

test("field errors block the call", async ({ page }) => {
  await prepare(page);
  const posts = countPosts(page);
  const dialog = await open(page);
  await expect(dialog.getByText(PINNED)).toBeVisible();
  const rows = dialog.getByRole("textbox", { name: "Rows" });
  const cap = dialog.getByLabel("Spend cap (dollars)");
  await rows.fill("52");
  await submit(dialog);
  await expect(dialog.getByText("Row 52 isn't a teaching day in this outline")).toBeVisible();
  await expect(rows).toBeFocused();
  await rows.fill("8");
  await cap.fill("0");
  await submit(dialog);
  await expect(dialog.getByText("Set a cap above $0")).toBeVisible();
  await expect(cap).toBeFocused();
  await cap.fill("");
  await submit(dialog);
  await expect(dialog.getByText("Set a cap above $0")).toBeVisible();
  expect(posts).toHaveLength(0);
});

const STATES = ["main", "loading", "field-errors", "validation-incomplete", "day-cap", "role-forbidden"] as const;
for (const state of STATES) {
  for (const [w, h] of [[1280, 900], [390, 844]] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`start-run ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await prepare(page, state === "loading" ? 8000 : 0);
        if (state === "validation-incomplete") await respondWithError(page, "startRun", "VALIDATION_INCOMPLETE", { errors_unconfirmed: 1 });
        if (state === "day-cap") await respondWithError(page, "startRun", "DAY_CAP_REACHED");
        if (state === "role-forbidden") await respondWithError(page, "startRun", "ROLE_FORBIDDEN");
        const dialog = await open(page, theme);
        if (state === "loading") await expect(page.getByTestId("prompt-skeleton")).toBeVisible();
        else await expect(dialog.getByText(PINNED)).toBeVisible();
        if (state === "field-errors") {
          await dialog.getByRole("textbox", { name: "Rows" }).fill("52");
          await dialog.getByLabel("Spend cap (dollars)").fill("0");
          await submit(dialog);
          await expect(dialog.getByText("Set a cap above $0")).toBeVisible();
        } else if (state !== "main" && state !== "loading") {
          await submit(dialog);
          await expect(page.getByRole("alert")).toBeVisible();
        }
        await page.evaluate(() => document.fonts.ready);
        const res = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        console.log(`axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`);
        await page.screenshot({ path: `${SHOTS}/start-run-${state}-${w}-${theme}.png`, fullPage: true });
        expect(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
      });
    }
  }
}
