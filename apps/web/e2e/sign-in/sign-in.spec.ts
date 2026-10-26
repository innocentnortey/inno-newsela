import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DEMO_PASSWORD, SESSIONS } from "../../src/test-utils/fixtures";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { apiGlob, signInAs, signInFlow } from "../../src/test-utils/sign-in-as";
import type { Role } from "../../src/lib/roles";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const SHOTS = "e2e/__screenshots__/sign-in";

async function unauthenticated(page: Page) {
  await respondWithError(page, "getSession", "UNAUTHENTICATED");
}
async function postSession(page: Page, handler: Parameters<Page["route"]>[1]) {
  await page.route(apiGlob("/session"), async (route, req) => {
    if (route.request().method() !== "POST") return route.fallback();
    return handler(route, req);
  });
}
async function fillAndSubmit(page: Page, role: Role = "author") {
  await page.getByLabel("Staff email").fill(SESSIONS[role].user.email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}
async function open(page: Page, url = "/sign-in") {
  await page.goto(url);
  await expect(page.getByLabel("Staff email")).toBeVisible();
}

test("loading keeps the button width and shows a spinner after 250 ms", async ({ page }) => {
  await signInFlow(page, "author", 900);
  await open(page);
  const button = page.getByRole("button", { name: "Sign in" });
  const before = (await button.boundingBox())!.width;
  await fillAndSubmit(page);
  await page.waitForTimeout(400);
  await expect(page.locator("[data-spinner]")).toBeVisible();
  expect((await button.boundingBox())!.width).toBe(before);
  await expect(page).toHaveURL(/\/units$/);
});

test("not on the staff list", async ({ page }) => {
  await unauthenticated(page);
  await respondWithError(page, "signIn", "NOT_ON_ALLOW_LIST");
  await open(page);
  await fillAndSubmit(page);
  await expect(page.getByText("This email is not on the staff list. Check the spelling or ask your content lead to add you.")).toBeVisible();
  await expect(page.getByLabel("Staff email")).toHaveValue(SESSIONS.author.user.email);
  await expect(page.getByLabel("Staff email")).toBeFocused();
});

test("invalid credentials", async ({ page }) => {
  await unauthenticated(page);
  await respondWithError(page, "signIn", "INVALID_CREDENTIALS");
  await open(page);
  await fillAndSubmit(page);
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeFocused();
});

test("network failure", async ({ page }) => {
  await unauthenticated(page);
  await postSession(page, (route) => route.abort());
  await open(page);
  await fillAndSubmit(page);
  await expect(page.getByText("Couldn't reach Lesson Studio. Try again.")).toBeVisible();
  await expect(page.getByLabel("Staff email")).toBeFocused();
});

for (const [role, landing] of [["author", /\/units$/], ["reviewer", /\/units\/g6-u4\/board$/], ["approver", /\/units\/g6-u4\/board$/]] as const) {
  test(`${role} lands on the right page`, async ({ page }) => {
    await signInFlow(page, role);
    await open(page);
    await fillAndSubmit(page, role);
    await expect(page).toHaveURL(landing);
  });
}

test("next param is honoured", async ({ page }) => {
  await signInFlow(page, "author");
  await open(page, "/sign-in?next=%2Funits%2Fg6-u4%2Fboard");
  await fillAndSubmit(page);
  await expect(page).toHaveURL(/\/units\/g6-u4\/board$/);
});

test("next param off-site is ignored", async ({ page }) => {
  await signInFlow(page, "author");
  await open(page, "/sign-in?next=https%3A%2F%2Fevil.example");
  await fillAndSubmit(page);
  await expect(page).toHaveURL(/localhost:\d+\/units$/);
});

test("already signed in redirects", async ({ page }) => {
  await signInAs(page, "reviewer");
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/units\/g6-u4\/board$/);
});

for (const state of ["main", "error"] as const) {
  for (const [w, h] of [[1280, 900], [390, 844]] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`sign-in ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await unauthenticated(page);
        if (state === "error") await respondWithError(page, "signIn", "INVALID_CREDENTIALS");
        await open(page);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        if (state === "error") {
          await fillAndSubmit(page);
          await expect(page.getByText("That email and password don't match.")).toBeVisible();
        }
        await page.evaluate(() => document.fonts.ready);
        const res = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        console.log(`axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`);
        await page.screenshot({ path: `${SHOTS}/sign-in-${state}-${w}-${theme}.png`, fullPage: true });
        expect(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
      });
    }
  }
}

test("demo accounts box lists the three roles", async ({ page }) => {
  await unauthenticated(page);
  await open(page);
  const box = page.getByRole("region", { name: "Demo accounts" });
  await expect(box).toBeVisible();
  for (const r of ["Author", "Reviewer", "Approver"]) await expect(box.getByText(r, { exact: true })).toBeVisible();
});
