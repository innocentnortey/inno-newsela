// NL-93 AC-12: SCR-2 and SCR-3, main and one error state, 1280x900 and 390x844, light and dark, on real data. Explicit screenshots
// (the real config's snapshotPathTemplate is hard-wired to con-1, so toHaveScreenshot is not used). 4 states x 4 cells = 16 files.
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { getStack } from "../support/real-stack";
import { matrix, setTheme } from "../support/axe";
import { createUser, signInAs } from "../support/users";
import { ISSUED_CSV, REPO_ROOT, noHeaderCsv } from "./fixtures/files";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { chooseAndUpload, fromPath, openUpload, postOutline } from "./support/upload";

test.beforeAll(ensureSeeded);
test.beforeEach(resetIntake);
const DIR = resolve(__dirname, "../../__screenshots__/integration/con-2");

async function shoot(page: Page, name: string): Promise<void> {
  mkdirSync(DIR, { recursive: true });
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    await page.evaluate(() => document.fonts.ready);
    const path = resolve(DIR, `${name}-${viewport.width}-${theme}.png`);
    await page.screenshot({ path, fullPage: true });
    expect(statSync(path).size).toBeGreaterThan(5 * 1024);
  });
}
const author = async (page: Page) => signInAs(page, await createUser("author"));

test("scr2 main (one uploaded version, no run yet) @visual", async ({ page }) => {
  await author(page);
  expect((await postOutline(page, getStack().baseURL, fromPath(ISSUED_CSV))).status).toBe(201);
  await page.goto("/units");
  await expect(page.getByText("No run yet. Confirm the report, then generate.")).toBeVisible();
  await shoot(page, "scr2-main");
});

test("scr2 error (cant load) @visual", async ({ page }) => {
  await author(page);
  await page.route("**/api/units", (r) => r.abort());
  await page.goto("/units");
  await expect(page.getByText("Couldn't load units.")).toBeVisible();
  await shoot(page, "scr2-cant-load");
});

test("scr3 main (file chosen) @visual", async ({ page }) => {
  await author(page);
  await openUpload(page);
  await page.locator("input[type=file]").setInputFiles(ISSUED_CSV);
  await expect(page.getByText("issued.csv").first()).toBeVisible();
  await shoot(page, "scr3-main");
});

test("scr3 error (header not found) @visual", async ({ page }) => {
  await author(page);
  await openUpload(page);
  await chooseAndUpload(page, noHeaderCsv());
  await expect(page.getByTestId("upload-error")).toContainText("Couldn't find the header row.");
  await shoot(page, "scr3-error-header-not-found");
});

test("no raw colour literals @visual", async () => {
  let status = 0;
  try {
    execFileSync("grep", ["-rnE", "#[0-9a-fA-F]{3,8}\\b|rgb\\(", "apps/web/src/features/units-home", "apps/web/src/features/upload-outline"], { cwd: REPO_ROOT, stdio: "pipe" });
  } catch (e) {
    status = (e as { status: number }).status;
  }
  expect(status, "grep exits 1 when there is no match").toBe(1);
});
