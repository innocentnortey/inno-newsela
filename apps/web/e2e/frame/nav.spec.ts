import { expect, test } from "@playwright/test";
import { SESSIONS } from "../../src/test-utils/fixtures";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { apiGlob, signInAs } from "../../src/test-utils/sign-in-as";

for (const role of ["author", "reviewer", "approver"] as const) {
  test(`nav ${role}`, async ({ page }) => {
    await signInAs(page, role);
    await page.goto("/units");
    const nav = page.getByRole("navigation").first();
    await expect(page.getByRole("link", { name: "Units" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Unit board" })).toBeVisible();
    const guidance = page.getByRole("link", { name: "Prompt guidance" });
    if (role === "author") await expect(guidance).toBeVisible();
    else await expect(guidance).toHaveCount(0);
    await expect(nav).toBeVisible();
    await expect(page.getByText(SESSIONS[role].user.name)).toBeVisible();
    await expect(page.getByText(role[0]!.toUpperCase() + role.slice(1), { exact: true })).toBeVisible();
  });
}

test("nav skip link focuses the main region, and sign out returns to sign-in", async ({ page }) => {
  await signInAs(page, "reviewer");
  await page.goto("/units");
  await expect(page.getByRole("heading", { name: "Units" })).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /skip/i })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.route(apiGlob("/session"), async (route) => {
    const m = route.request().method();
    if (m === "DELETE") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    return route.fallback();
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  // after sign out the session is gone
  await page.unroute(apiGlob("/session"));
  await respondWithError(page, "getSession", "UNAUTHENTICATED");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("one rail item is current", async ({ page }) => {
  await signInAs(page, "reviewer");
  await page.goto("/units/g6-u4/board");
  await expect(page.getByRole("link", { name: "Unit board" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator('nav[aria-label="Primary"] [aria-current="page"]')).toHaveCount(1);
  await page.goto("/units");
  await expect(page.getByRole("link", { name: "Units", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator('nav[aria-label="Primary"] [aria-current="page"]')).toHaveCount(1);
});

const unitFor = (unit_key: string, created_at: string) => ({
  unit_id: unit_key.toUpperCase(),
  unit_key,
  title: unit_key,
  versions: [{
    outline_version_id: `ov-${unit_key}`, unit_id: unit_key.toUpperCase(), unit_key, version_number: 1, sha256: "a".repeat(64),
    same_as_version: null, changed_lessons: 0, row_counts: { lessons: 30, flex_days: 6, arc_headers: 4, total_rows: 40 },
    created_at, created_by: "Author A (demo)",
  }],
  latest_run: null,
});

async function stubUnits(page: import("@playwright/test").Page, units: ReturnType<typeof unitFor>[]) {
  await page.route(apiGlob("/units"), async (route) => {
    // The glob also matches the page URL /units; only the API call (fetch) is stubbed.
    if (route.request().method() !== "GET" || route.request().resourceType() !== "fetch") return route.fallback();
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ units }) });
  });
}

test("Unit board points at the most recent unit and opens its board", async ({ page }) => {
  await signInAs(page, "reviewer");
  await stubUnits(page, [unitFor("g6-u4", "2026-10-01T00:00:00Z"), unitFor("g7-u2", "2026-10-20T00:00:00Z")]);
  await page.goto("/units");
  const link = page.getByRole("link", { name: "Unit board" });
  await expect(link).toHaveAttribute("href", "/units/g7-u2/board");
  await link.click();
  await expect(page).toHaveURL(/\/units\/g7-u2\/board$/);
});

test("Unit board falls back to /units when there are no units", async ({ page }) => {
  await signInAs(page, "reviewer");
  await stubUnits(page, []);
  await page.goto("/units");
  await expect(page.getByRole("link", { name: "Unit board" })).toHaveAttribute("href", "/units");
});

test("Unit board stays on the unit in view even when another is newer", async ({ page }) => {
  await signInAs(page, "reviewer");
  await stubUnits(page, [unitFor("g6-u4", "2026-10-01T00:00:00Z"), unitFor("g7-u2", "2026-10-20T00:00:00Z")]);
  await page.goto("/units/g6-u4/board");
  await expect(page.getByRole("link", { name: "Unit board" })).toHaveAttribute("href", "/units/g6-u4/board");
});
