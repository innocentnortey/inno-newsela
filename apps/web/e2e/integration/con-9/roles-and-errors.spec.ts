// NL-98 AC-6: every role reads; row clicks go to the role's destination; a failed row's Retry links to SCR-6; a tile fetch failure keeps the table.
import { expect, test, type Page } from "@playwright/test";
import { COPY, getJson, openBoard } from "./helpers";
import { insertRun, MAIN_PLAN, seedMainUnit, user } from "./seed";

const submitted = MAIN_PLAN.find((l) => l.state === "submitted")!.number;
const draft = MAIN_PLAN.find((l) => l.state === "draft")!.number;
const link = (page: Page, n: number) => page.getByRole("link", { name: `Synthetic lesson ${n}`, exact: true });

for (const role of ["author", "reviewer", "approver"] as const) {
  test(`roles-and-errors: ${role} reads the board and the tile (200)`, async ({ page }) => {
    const seeded = await seedMainUnit();
    await openBoard(page, await user(role, `role-${role}`));
    expect((await getJson(page, "/api/units/G6.U4/board")).status).toBe(200);
    expect((await getJson(page, "/api/units/G6.U4/metrics")).status).toBe(200);
    await expect(page.getByText("approved 3 of 47")).toBeVisible();
    expect(seeded.unit_id).toBe("G6.U4");
  });
}

test("roles-and-errors: a reviewer's click on a row opens the lesson page (SCR-9)", async ({ page }) => {
  const seeded = await seedMainUnit();
  await openBoard(page, seeded.reviewers[0]!);
  await link(page, submitted).click();
  await expect(page).toHaveURL(new RegExp(`/units/g6-u4/lessons/L${submitted}$`));
});

test("roles-and-errors: an approver's click opens approve on a submitted row and the lesson page on any other row", async ({ page }) => {
  await seedMainUnit();
  await openBoard(page, await user("approver", "role-approver"));
  await link(page, submitted).click();
  await expect(page).toHaveURL(new RegExp(`/units/g6-u4/lessons/L${submitted}/approve$`));
  await page.goto("/units/g6-u4/board");
  await link(page, draft).click();
  await expect(page).toHaveURL(new RegExp(`/units/g6-u4/lessons/L${draft}$`));
});

test("roles-and-errors: an author's row opens the lesson page, and a failed row's Retry is a link to the run (SCR-6)", async ({ page }) => {
  const author = await user("author", "role-author");
  await seedMainUnit();
  const runId = await insertRun("G6.U4", "complete", author);
  await openBoard(page, author);
  const failedRow = page.locator("tbody tr").filter({ has: page.getByText(COPY.failed, { exact: true }) }).first();
  const retry = failedRow.getByRole("link", { name: "Retry" });
  await expect(retry).toHaveAttribute("href", `/units/g6-u4/runs/${runId}`);
  await link(page, submitted).click();
  await expect(page).toHaveURL(new RegExp(`/units/g6-u4/lessons/L${submitted}$`));
});

test("roles-and-errors: tile fetch fails -> roll-up and table stay, the tile says it could not load, Retry brings it back", async ({ page }) => {
  const seeded = await seedMainUnit();
  await page.route("**/api/units/*/metrics", (r) => r.abort());
  await openBoard(page, seeded.reviewers[0]!);
  await expect(page.getByText(COPY.tileError)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Where the 47 lessons are/ })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(47);
  await page.unroute("**/api/units/*/metrics");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("approved 3 of 47")).toBeVisible();
  await expect(page.getByText(COPY.tileError)).toHaveCount(0);
});
