import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import type { Role } from "../../src/lib/roles";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { apiGlob, signInAs } from "../../src/test-utils/sign-in-as";
import { ISSUES31, LESSON31, RESULT } from "./fixtures";

type Lesson = components["schemas"]["Lesson"];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const axe = (page: Page) => new AxeBuilder({ page: page as unknown as AxePage });
const SHOTS = path.resolve(__dirname, "../__screenshots__/resolve");
const HARNESS = "/harness/resolve";
const cors = { "access-control-allow-origin": "*", "x-request-id": "req-test" };
const CLEAR = "?mode=clear_flag&target=iss-31-1";
const RESOLVE = "?mode=resolve&target=iss-31-2";

async function serve(page: Page, opts: { state?: Lesson["state"] } = {}) {
  const s = { issues: structuredClone(ISSUES31), calls: [] as (string | null)[] };
  const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  await page.route(apiGlob("/lessons/*"), (route) => {
    if (route.request().resourceType() === "document") return route.continue();
    return route.request().method() === "GET" ? json(route, { ...LESSON31, state: opts.state ?? "in_review" }) : route.fallback();
  });
  await page.route(apiGlob("/lessons/*/issues"), (route) => json(route, s.issues));
  const mark = (id: string, status: "resolved" | "cleared", route: Route) => {
    s.calls.push(route.request().postData());
    s.issues.issues = s.issues.issues.map((i) => (i.issue_id === id ? { ...i, resolution: { by: "J. Rivera", reason: "done", at: "2026-10-25T16:00:00Z" } } : i));
    return json(route, RESULT(status, id));
  };
  await page.route(apiGlob("/lessons/*/issues/*/resolution"), (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return mark(route.request().url().split("/issues/")[1]!.split("/")[0]!, "resolved", route);
  });
  await page.route(apiGlob("/lessons/*/safety-flags/*/clear"), (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    return mark(route.request().url().split("/safety-flags/")[1]!.split("/")[0]!, "cleared", route);
  });
  return s;
}

/** Count POSTs that reach the network (used when a response is forced to fail). */
function countPosts(page: Page) {
  const calls: (string | null)[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /resolution|clear/.test(r.url())) calls.push(r.postData());
  });
  return calls;
}

async function open(page: Page, role: Role, query: string) {
  await signInAs(page, role);
  await page.goto(`${HARNESS}${query}`);
}
const dialog = (page: Page) => page.getByRole("dialog");
const field = (page: Page) => dialog(page).getByRole("textbox");

test("states: resolve mode shows sentence, required reason, helper, not-a-fix line", async ({ page }) => {
  await serve(page);
  await open(page, "reviewer", RESOLVE);
  const d = dialog(page);
  await expect(d.getByText("Record a resolution")).toBeVisible();
  await expect(d.getByText("Quote placeholder open in Learning in Action Part A")).toBeVisible();
  await expect(d.getByLabel("Reason (required)")).toBeVisible();
  await expect(d.getByText("e.g. quote inserted from class copy")).toBeVisible();
  await expect(d.getByText("Counted as a resolution, not a fix.")).toBeVisible();
});

test("states: clear mode shows Lesson 31 flag, quoted tip and logging line", async ({ page }) => {
  await serve(page);
  await open(page, "reviewer", CLEAR);
  const d = dialog(page);
  await expect(d.getByText("Safety flag open · content warning from the outline")).toBeVisible();
  await expect(d.locator("blockquote")).toContainText("Warn students about potentially triggering scene");
  await expect(d.getByLabel("Note (required)")).toBeVisible();
  await expect(d.getByText("Your name, note and the time are logged")).toBeVisible();
});

test("errors: REASON_REQUIRED keeps text and refocuses", async ({ page }) => {
  await serve(page);
  await respondWithError(page, "recordResolution", "REASON_REQUIRED");
  await open(page, "reviewer", RESOLVE);
  await field(page).fill("  ");
  await dialog(page).getByRole("button", { name: "Record resolution" }).click();
  await expect(dialog(page).getByText("A resolution needs a reason. Say what was done and where.")).toBeVisible();
  await expect(field(page)).toHaveValue("  ");
  await expect(field(page)).toBeFocused();
});

test("errors: NOTE_REQUIRED keeps text and refocuses", async ({ page }) => {
  await serve(page);
  await respondWithError(page, "clearSafetyFlag", "NOTE_REQUIRED");
  await open(page, "reviewer", CLEAR);
  await field(page).fill(" ");
  await dialog(page).getByRole("button", { name: "Clear flag" }).click();
  await expect(dialog(page).getByText("Clearing a safety flag needs a note. Say what you checked.")).toBeVisible();
  await expect(field(page)).toHaveValue(" ");
  await expect(field(page)).toBeFocused();
});

test("errors: NOT_RESOLVABLE names details.use", async ({ page }) => {
  await serve(page);
  await respondWithError(page, "recordResolution", "NOT_RESOLVABLE", { use: "Clear flag" });
  await open(page, "reviewer", RESOLVE);
  await field(page).fill("x");
  await dialog(page).getByRole("button", { name: "Record resolution" }).click();
  await expect(dialog(page).getByRole("alert")).toContainText('Use "Clear flag" instead.');
});

test("errors: LESSON_LOCKED names the state", async ({ page }) => {
  await serve(page);
  await respondWithError(page, "recordResolution", "LESSON_LOCKED", { state: "submitted" });
  await open(page, "reviewer", RESOLVE);
  await field(page).fill("x");
  await dialog(page).getByRole("button", { name: "Record resolution" }).click();
  await expect(dialog(page).getByRole("alert")).toContainText("This lesson is submitted, so nothing was saved.");
});

test("errors: network keeps the text", async ({ page }) => {
  await serve(page);
  await page.route(apiGlob("/lessons/*/issues/*/resolution"), (r) => (r.request().method() === "POST" ? r.abort() : r.fallback()));
  await open(page, "reviewer", RESOLVE);
  await field(page).fill("kept");
  await dialog(page).getByRole("button", { name: "Record resolution" }).click();
  await expect(dialog(page).getByRole("alert")).toContainText("Couldn't save. Your text is kept. Try again.");
  await expect(field(page)).toHaveValue("kept");
});

test("server-authority: empty and whitespace-only reason still sends once, raw", async ({ page }) => {
  await serve(page);
  await respondWithError(page, "recordResolution", "REASON_REQUIRED");
  const calls = countPosts(page);
  await open(page, "reviewer", RESOLVE);
  await field(page).fill("   ");
  await dialog(page).getByRole("button", { name: "Record resolution" }).click();
  await expect(dialog(page).getByText("A resolution needs a reason.")).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0]!).reason).toBe("   ");
});

test("server-authority: empty note still sends once, raw", async ({ page }) => {
  await serve(page);
  await respondWithError(page, "clearSafetyFlag", "NOTE_REQUIRED");
  const calls = countPosts(page);
  await open(page, "reviewer", CLEAR);
  await dialog(page).getByRole("button", { name: "Clear flag" }).click();
  await expect(dialog(page).getByText("Clearing a safety flag needs a note.")).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0]!).note).toBe("");
});

test("roles: author sees forbidden sentence and no submit", async ({ page }) => {
  await serve(page);
  await open(page, "author", CLEAR);
  await expect(dialog(page).getByText("Only reviewers and approvers can clear a flag.")).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Clear flag" })).toHaveCount(0);
  await expect(dialog(page).getByRole("textbox")).toHaveCount(0);
});

test("roles: reviewer sees Clear flag", async ({ page }) => {
  await serve(page);
  await open(page, "reviewer", CLEAR);
  await expect(dialog(page).getByRole("button", { name: "Clear flag" })).toBeVisible();
});

test("roles: approver can clear on a submitted lesson", async ({ page }) => {
  const s = await serve(page, { state: "submitted" });
  await open(page, "approver", CLEAR);
  await field(page).fill("Checked the chapter; warning stays in teacher text.");
  await dialog(page).getByRole("button", { name: "Clear flag" }).click();
  await expect(page.getByText("Safety flag cleared.")).toBeVisible();
  expect(s.calls).toHaveLength(1);
});

test('success: resolve toasts "Issue resolved by J. Rivera." and focus returns to the card', async ({ page }) => {
  await serve(page);
  await open(page, "reviewer", RESOLVE);
  await field(page).fill("quote inserted from class copy");
  await dialog(page).getByRole("button", { name: "Record resolution" }).click();
  await expect(page.getByText("Issue resolved by J. Rivera.")).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('[data-issue-id="iss-31-2"] [data-issue-card]')).toBeFocused();
  await expect(page.getByRole("heading", { name: "Resolved" })).toBeVisible();
});

test('success: clear toasts "Safety flag cleared."', async ({ page }) => {
  await serve(page);
  await open(page, "reviewer", CLEAR);
  await field(page).fill("Checked the chapter.");
  await dialog(page).getByRole("button", { name: "Clear flag" }).click();
  await expect(page.getByText("Safety flag cleared.")).toBeVisible();
  await expect(page.locator('[data-issue-id="iss-31-1"] [data-issue-card]')).toBeFocused();
  await expect(page.getByRole("heading", { name: "Resolved" })).toBeVisible();
});

const STATES = [
  { name: "resolve-form", shot: "main", query: RESOLVE, role: "reviewer" as Role, err: false },
  { name: "resolve-error", shot: "error", query: RESOLVE, role: "reviewer" as Role, err: true },
  { name: "clear-form", shot: null, query: CLEAR, role: "reviewer" as Role, err: false },
  { name: "clear-forbidden", shot: null, query: CLEAR, role: "author" as Role, err: false },
];
const VIEWS = [{ w: 1280, h: 900 }, { w: 390, h: 844 }];

for (const st of STATES) {
  for (const v of VIEWS) {
    for (const theme of ["light", "dark"] as const) {
      test(`${st.name} ${v.w}x${v.h} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: v.w, height: v.h });
        await serve(page);
        if (st.err) await respondWithError(page, "recordResolution", "REASON_REQUIRED");
        await open(page, st.role, st.query);
        await expect(dialog(page)).toBeVisible();
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        if (st.err) {
          await dialog(page).getByRole("button", { name: "Record resolution" }).click();
          await expect(dialog(page).getByText("A resolution needs a reason.")).toBeVisible();
        } else if (st.role !== "author") {
          await expect(dialog(page).getByText(/Quote placeholder|Safety flag open/)).toBeVisible();
        }
        if (st.shot) await page.screenshot({ path: `${SHOTS}/resolve-${st.shot}-${v.w}-${theme}.png`, fullPage: true });
        const results = await axe(page).withTags(TAGS).analyze();
        const bad = results.violations.filter((x) => x.impact === "serious" || x.impact === "critical");
        expect(bad.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        console.log(`axe ${st.name} ${v.w} ${theme}: 0 serious/critical`);
      });
    }
  }
}
