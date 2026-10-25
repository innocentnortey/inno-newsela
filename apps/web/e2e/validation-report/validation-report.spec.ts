import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { signInAs } from "../../src/test-utils/sign-in-as";
import type { Role } from "../../src/lib/roles";
import {
  cleanReport,
  confirmAllErrors,
  confirmSome,
  issuedShapeReport,
  markupReport,
  unitsFixture,
  withRun,
  type Report,
  type UnitList,
} from "./fixtures";
import { installReportMock, type ReportMock } from "./report-mock";

test.use({ timezoneId: "UTC", locale: "en-US" });

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const SHOTS = "e2e/__screenshots__/validation-report";

async function open(page: Page, opts: { role?: Role; report?: Report; units?: UnitList; delayMs?: number; version?: number } = {}): Promise<ReportMock> {
  await signInAs(page, opts.role ?? "author");
  const ctrl = await installReportMock(page, opts);
  await page.goto(`/units/g6-u4/outlines/${opts.version ?? 1}`);
  return ctrl;
}
const ready = (page: Page) => expect(page.getByRole("heading", { level: 1, name: "Grade 6 · Unit 4" })).toBeVisible();

test("loading: skeleton shows, then Reading 47 rows after one second", async ({ page }) => {
  await open(page, { delayMs: 2500 });
  await expect(page.getByRole("status", { name: "Loading the validation report" })).toBeVisible();
  await expect(page.getByText("Reading 47 rows…")).toBeVisible({ timeout: 2000 });
  await ready(page);
});

test("clean: no errors shows the success banner and Generate is on", async ({ page }) => {
  await open(page, { report: cleanReport() });
  await ready(page);
  await expect(page.getByText("No errors to confirm. 0 warnings.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate 47 lessons" })).not.toHaveAttribute("aria-disabled", "true");
});

test("confirm: one error shows who and when, counts drop, Undo restores", async ({ page }) => {
  await open(page);
  await ready(page);
  await expect(page.getByText("5 errors to confirm").first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm fix for row 8" }).click();
  await expect(page.getByText("Confirmed by A. Chen · 10:42")).toBeVisible();
  await expect(page.getByText("4 errors to confirm").first()).toBeVisible();
  await expect(page.getByText("4 errors still to confirm")).toBeVisible();
  await page.getByRole("button", { name: "Undo confirmation for row 8" }).click();
  await expect(page.getByText("5 errors to confirm").first()).toBeVisible();
});

test("confirm: an untouched warning says Default and a changed one says Changed by A. Chen", async ({ page }) => {
  await open(page);
  await ready(page);
  const group = page.getByRole("group", { name: "Action for row 8, column N" });
  await expect(group.locator("xpath=..").getByText("Default")).toBeVisible();
  await group.getByText("Ignore").click();
  await expect(group.locator("xpath=..").getByText("Changed by A. Chen")).toBeVisible();
});

test("confirm: all five confirmed turns the banner to success and Generate opens the run dialog", async ({ page }) => {
  await open(page);
  await ready(page);
  for (const name of ["Confirm U4 for the unit", "Confirm fix for row 8", "Confirm fix for row 30", "Confirm fix for row 34", "Confirm fix for row 39"]) {
    await page.getByRole("button", { name }).click();
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  }
  await expect(page.getByText("All 5 errors confirmed. Generate is on.")).toBeVisible();
  await page.getByRole("button", { name: "Generate 47 lessons" }).click();
  await expect(page.getByRole("dialog", { name: "Start a run" })).toBeVisible();
});

test("eld: 7 of 12 codes are flagged with the sheet label beside the strand", async ({ page }) => {
  await open(page);
  await ready(page);
  const table = page.getByRole("table", { name: "ELD labels: 7 of 12 codes flagged" });
  await expect(table.locator("tbody tr")).toHaveCount(7);
  await expect(table.getByRole("radio", { name: "Keep" })).toHaveCount(7);
  await expect(table.getByText("Re-map to").first()).toBeVisible();
  await expect(page.locator("dt", { hasText: "ELD labels flagged" }).locator("xpath=following-sibling::dd[1]")).toHaveText("7");
  await expect(page.locator("dt", { hasText: "ELD findings" }).locator("xpath=following-sibling::dd[1]")).toHaveText("16");
});

test("errors: a failed save keeps the choice and offers Try again", async ({ page }) => {
  const ctrl = await open(page);
  await ready(page);
  ctrl.failNext("SERVICE_BUSY");
  const group = page.getByRole("group", { name: "Action for row 8, column N" });
  await group.getByText("Ignore").click();
  await expect(page.getByText("Couldn't save this choice. Try again.")).toBeVisible();
  await expect(group.getByRole("radio", { name: "Ignore" })).toBeChecked();
  await expect(page.getByText("5 errors to confirm").first()).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Couldn't save this choice. Try again.")).toHaveCount(0);
  await expect(group.getByRole("radio", { name: "Ignore" })).toBeChecked();
});

test("errors: INVALID_CHOICE keeps the editor open with its message", async ({ page }) => {
  await open(page);
  await ready(page);
  await page.getByRole("button", { name: "Edit fix for row 30" }).click();
  const input = page.getByLabel("Corrected code for row 30");
  await input.fill("RL.6.9.a");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(`"RL.6.9.a" is not a California standard. Use a code from the standards list, e.g. RL.6.9.`)).toBeVisible();
  await expect(input).toBeVisible();
});

test("errors: a stale tab gets Generate refused and focus on the first unconfirmed error", async ({ page }) => {
  const ctrl = await open(page, { report: confirmAllErrors(issuedShapeReport()) });
  await ready(page);
  ctrl.setReport(confirmSome(issuedShapeReport(), ["f-unit", "f-row8", "f-30", "f-34"]));
  await page.getByRole("button", { name: "Generate 47 lessons" }).click();
  await expect(page.getByText("Generate refused: 1 error still to confirm.")).toBeVisible();
  await expect(page.locator("[data-first-unconfirmed]")).toBeFocused();
});

test("errors: ROLE_FORBIDDEN shows the server sentence", async ({ page }) => {
  await open(page);
  await ready(page);
  await respondWithError(page, "recordIntakeChoice", "ROLE_FORBIDDEN");
  await page.getByRole("button", { name: "Confirm fix for row 8" }).click();
  await expect(page.getByText("Test message for ROLE_FORBIDDEN")).toBeVisible();
});

test("markup: script and b tags show as literal characters", async ({ page }) => {
  let dialogs = 0;
  page.on("dialog", (d) => {
    dialogs++;
    void d.dismiss();
  });
  await open(page, { report: markupReport() });
  await ready(page);
  await expect(page.getByText("<script>alert(1)</script>").first()).toBeVisible();
  await expect(page.getByText("<b>x</b>").first()).toBeVisible();
  expect(await page.locator("main script, main b").count()).toBe(0);
  expect(dialogs).toBe(0);
});

for (const role of ["reviewer", "approver"] as const) {
  test(`readonly: ${role} sees no controls`, async ({ page }) => {
    await open(page, { role });
    await ready(page);
    await expect(page.getByText(new RegExp(`You're viewing as an? ${role}\\. Only authors confirm the report\\.`))).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Confirm|Edit|Undo|Generate)/ })).toHaveCount(0);
    await expect(page.locator("input[type=radio]")).toHaveCount(0);
  });
}

test("banners: older version", async ({ page }) => {
  await open(page, { units: unitsFixture(2) });
  await ready(page);
  await expect(page.getByText("This is version 1. Version 2 was uploaded at 11:05.")).toBeVisible();
});

test("banners: same hash", async ({ page }) => {
  await open(page, { units: unitsFixture(2, 1) });
  await ready(page);
  await expect(page.getByText("Version 2 is the same as version 1; 0 lessons changed.")).toBeVisible();
});

test("banners: frozen after a run", async ({ page }) => {
  await open(page, { report: withRun(issuedShapeReport()) });
  await ready(page);
  await expect(page.getByText("A run started from these choices at 10:50. Changes apply to the next run.")).toBeVisible();
});

type State = "main" | "partial" | "success" | "editing" | "failed" | "refused" | "viewer" | "older";
const STATES: State[] = ["main", "partial", "success", "editing", "failed", "refused", "viewer", "older"];

async function reach(page: Page, state: State): Promise<void> {
  const confirmed = ["f-unit", "f-row8"];
  if (state === "partial") await open(page, { report: confirmSome(issuedShapeReport(), confirmed) });
  else if (state === "success") await open(page, { report: confirmAllErrors(issuedShapeReport()) });
  else if (state === "viewer") await open(page, { role: "reviewer" });
  else if (state === "older") await open(page, { units: unitsFixture(2) });
  else if (state === "refused") {
    const ctrl = await open(page, { report: confirmAllErrors(issuedShapeReport()) });
    await ready(page);
    ctrl.setReport(confirmSome(issuedShapeReport(), confirmed));
    await page.getByRole("button", { name: "Generate 47 lessons" }).click();
    await expect(page.getByText(/Generate refused/)).toBeVisible();
    return;
  } else {
    const ctrl = await open(page);
    await ready(page);
    if (state === "editing") {
      await page.getByRole("button", { name: "Edit fix for row 30" }).click();
      await page.getByLabel("Corrected code for row 30").fill("RL.6.9.a");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText(/is not a California standard/)).toBeVisible();
    }
    if (state === "failed") {
      ctrl.failNext("SERVICE_BUSY");
      await page.getByRole("group", { name: "Action for row 8, column N" }).getByText("Ignore").click();
      await expect(page.getByText("Couldn't save this choice. Try again.")).toBeVisible();
    }
    return;
  }
  await ready(page);
}

for (const state of STATES) {
  for (const [w, h] of [[1280, 900], [390, 844]] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`axe ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await reach(page, state);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.evaluate(() => document.fonts.ready);
        const res = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        console.log(`axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`);
        if (state === "main" || state === "failed") {
          await page.screenshot({ path: `${SHOTS}/validation-report-${state}-${w}-${theme}.png`, fullPage: true });
        }
        expect(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
      });
    }
  }
}
