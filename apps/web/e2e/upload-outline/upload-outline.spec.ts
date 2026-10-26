import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { components } from "../../src/lib/api-types";
import type { Role } from "../../src/lib/roles";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { mockOperation } from "../../src/test-utils/mock-operation";
import { apiGlob, signInAs } from "../../src/test-utils/sign-in-as";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
type OV = components["schemas"]["OutlineVersion"];
const SHOTS = "e2e/__screenshots__/upload-outline";
const URL = "/units/g6-u4/outlines/new";
const SHEET = "https://docs.google.com/spreadsheets/d/EXAMPLE-SYNTHETIC-ID/edit";
const SUMMARY = "Grade 6 · Unit 4 · version 1 · 41 lessons · 6 flex days · 7 arc headers · 1 total row";
const SAME = "Version 2 is the same as version 1; 0 lessons changed.";

const firstUpload: OV = {
  outline_version_id: "G6.U4.ov1",
  unit_id: "G6.U4",
  unit_key: "g6-u4",
  version_number: 1,
  sha256: "a100000000000000000000000000000000000000000000000000000000000001",
  same_as_version: null,
  changed_lessons: 0,
  row_counts: { lessons: 41, flex_days: 6, arc_headers: 7, total_rows: 1 },
  created_at: "2026-10-25T14:50:00Z",
  created_by: "Author (demo)",
} as OV;
const sameAsV1: OV = { ...firstUpload, outline_version_id: "G6.U4.ov2", version_number: 2, same_as_version: 1, created_at: "2026-10-25T15:02:00Z" } as OV;

const fulfilJson = (body: OV, status = 201) => ({
  status,
  contentType: "application/json",
  headers: { "access-control-allow-origin": "*" },
  body: JSON.stringify(body),
});

async function open(page: Page, role: Role = "author") {
  await signInAs(page, role);
  await page.goto(URL);
  await expect(page.getByRole("heading", { level: 1, name: "Upload outline" })).toBeVisible();
}
const pick = (page: Page) =>
  page.locator("input[type=file]").setInputFiles({
    name: "g6-u4-outline.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("synthetic outline bytes"),
  });
const alertBox = (page: Page) => page.getByTestId("upload-error");
async function routePost(page: Page, path: string, handler: Parameters<Page["route"]>[1]) {
  await page.route(apiGlob(path), (route, req) => (route.request().method() !== "POST" ? route.fallback() : handler(route, req)));
}
async function toLink(page: Page) {
  await page.getByText("Sheet link", { exact: true }).click();
  await page.getByLabel("Google Sheet link").fill(SHEET);
}
async function expectError(page: Page, text: string) {
  await expect(alertBox(page)).toContainText(text);
  await expect(alertBox(page)).toBeFocused();
  await expect(alertBox(page).getByRole("alert")).toHaveCount(1);
}

test("loading shows the stage lines", async ({ page }) => {
  test.setTimeout(60_000);
  await routePost(page, "/outline-versions", async (route) => {
    await new Promise((r) => setTimeout(r, 10_600));
    await route.fulfill(fulfilJson(firstUpload));
  });
  await open(page);
  await pick(page);
  const button = page.getByRole("button", { name: "Upload" });
  await button.click();
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Reading rows…", { exact: true })).toBeVisible({ timeout: 3000 });
  await expect(page.getByText("Reading rows · Checking codes")).toBeVisible({ timeout: 11_000 });
  await expect(page.getByText(SUMMARY).first()).toBeVisible({ timeout: 5000 });
});

test("error SHEET_NOT_PUBLIC", async ({ page }) => {
  await respondWithError(page, "importOutlineLink", "SHEET_NOT_PUBLIC");
  await open(page);
  await toLink(page);
  await page.getByRole("button", { name: "Import" }).click();
  await expectError(page, "This sheet is private. Share it publicly or upload the file.");
  await expect(page.getByLabel("Google Sheet link")).toHaveValue(SHEET);
});

test("error UNSUPPORTED_FILE", async ({ page }) => {
  await respondWithError(page, "uploadOutline", "UNSUPPORTED_FILE", { reason: "type" });
  await open(page);
  await pick(page);
  await page.getByRole("button", { name: "Upload" }).click();
  await expectError(page, "This file type isn't supported. Upload a CSV or XLSX file.");
  await expect(page.getByTestId("chosen-file")).toHaveText("Chosen: g6-u4-outline.xlsx");
});

test("unsupported file: the type banner shows alone after Upload, without Choose a file first", async ({ page }) => {
  await open(page);
  await page.locator("input[type=file]").setInputFiles({ name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(alertBox(page)).toContainText("This file type isn't supported. Upload a CSV or XLSX file.");
  await expect(page.getByText("Choose a file first.")).toHaveCount(0);
});

test("error HEADER_NOT_FOUND", async ({ page }) => {
  await respondWithError(page, "uploadOutline", "HEADER_NOT_FOUND", { columns_looked_for: ["Lesson #", "Focus", "Standards"] });
  await open(page);
  await pick(page);
  await page.getByRole("button", { name: "Upload" }).click();
  await expectError(page, "Couldn't find the header row. We looked for these columns: Lesson #, Focus, Standards.");
});

test("error TOO_MANY_ROWS", async ({ page }) => {
  await respondWithError(page, "uploadOutline", "TOO_MANY_ROWS", { max_rows: 200, rows: 214 });
  await open(page);
  await pick(page);
  await page.getByRole("button", { name: "Upload" }).click();
  await expectError(page, "Too many rows for one unit: this sheet has 214 rows; the limit is 200.");
});

test("error SHEET_UNREACHABLE", async ({ page }) => {
  let n = 0;
  await routePost(page, "/outline-versions/import", (route) => {
    n += 1;
    if (n === 1) {
      return route.fulfill({
        status: 502,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ error: { code: "SHEET_UNREACHABLE", message: "Test message for SHEET_UNREACHABLE", details: {} } }),
      });
    }
    return route.fulfill(fulfilJson(sameAsV1, 200));
  });
  await open(page);
  await toLink(page);
  await page.getByRole("button", { name: "Import" }).click();
  await expectError(page, "Couldn't reach Google Sheets. Try again, or upload the file.");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText(SAME).first()).toBeVisible();
});

test("success first upload", async ({ page }) => {
  await mockOperation(page, "uploadOutline", { example: "firstUpload" });
  await open(page);
  await pick(page);
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText(SUMMARY).first()).toBeVisible();
  await expect(page).toHaveURL(/\/units\/g6-u4\/outlines\/1$/);
});

test("success first link import", async ({ page }) => {
  await routePost(page, "/outline-versions/import", (route) => route.fulfill(fulfilJson(firstUpload)));
  await open(page);
  await toLink(page);
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText(SUMMARY).first()).toBeVisible();
  await expect(page).toHaveURL(/\/units\/g6-u4\/outlines\/1$/);
});

async function expectSame(page: Page) {
  await expect(page.getByText(SAME).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the report" })).toHaveAttribute("href", /\/units\/g6-u4\/outlines\/2$/);
  await page.waitForTimeout(2000);
  await expect(page).toHaveURL(/\/outlines\/new$/);
}

test("success same hash upload", async ({ page }) => {
  await routePost(page, "/outline-versions", (route) => route.fulfill(fulfilJson(sameAsV1)));
  await open(page);
  await pick(page);
  await page.getByRole("button", { name: "Upload" }).click();
  await expectSame(page);
});

test("success same hash link", async ({ page }) => {
  await mockOperation(page, "importOutlineLink", { example: "sameAsV1" });
  await open(page);
  await toLink(page);
  await page.getByRole("button", { name: "Import" }).click();
  await expectSame(page);
});

for (const role of ["reviewer", "approver"] as const) {
  test(`${role} sees no controls`, async ({ page }) => {
    await open(page, role);
    await expect(page.getByText("Only authors can upload an outline")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the board" })).toBeVisible();
    await expect(page.locator("main").getByRole("button")).toHaveCount(0);
    await expect(page.locator("input[type=file]")).toHaveCount(0);
  });
}

test("keyboard opens the file picker", async ({ page }) => {
  await open(page);
  const choose = page.getByRole("button", { name: "Choose file" });
  for (let i = 0; i < 12 && !(await choose.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(choose).toBeFocused();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await chooser;
});

const STATES = ["file-main", "link-main", "error", "success", "same-hash", "forbidden"] as const;
for (const state of STATES) {
  for (const [w, h] of [[1280, 900], [390, 844]] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`upload-outline ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        if (state === "error") await respondWithError(page, "importOutlineLink", "SHEET_NOT_PUBLIC");
        if (state === "success") {
          await page.route("**/units/g6-u4/outlines/1", (r) => r.abort());
          await routePost(page, "/outline-versions", (route) => route.fulfill(fulfilJson(firstUpload)));
        }
        if (state === "same-hash") await routePost(page, "/outline-versions", (route) => route.fulfill(fulfilJson(sameAsV1)));
        await open(page, state === "forbidden" ? "reviewer" : "author");
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        if (state === "link-main") await toLink(page);
        if (state === "error") {
          await toLink(page);
          await page.getByRole("button", { name: "Import" }).click();
          await expect(page.getByText("This sheet is private. Share it publicly or upload the file.")).toBeVisible();
        }
        if (state === "success" || state === "same-hash") {
          await pick(page);
          await page.getByRole("button", { name: "Upload" }).click();
          await expect(page.getByText(state === "success" ? SUMMARY : SAME).first()).toBeVisible();
        }
        await page.evaluate(() => document.fonts.ready);
        const res = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        console.log(`axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`);
        if (state === "file-main" || state === "error") {
          await page.screenshot({ path: `${SHOTS}/upload-outline-${state}-${w}-${theme}.png`, fullPage: true });
        }
        expect(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
      });
    }
  }
}
