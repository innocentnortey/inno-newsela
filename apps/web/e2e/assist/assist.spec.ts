import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { signInAs } from "../../src/test-utils/sign-in-as";
import { SELECTED, onePending, stubAssist, type AssistCtl } from "./fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const URL = "/harness/assist?lesson=G6.U4.L5";
const SHOTS = path.join(__dirname, "..", "__screenshots__", "assist");
const WARN = "Don't paste student work.";
const REASON = "Accept or reject the AI suggestion first";

test.use({ timezoneId: "UTC", locale: "en-US" });

async function open(page: Page, init: Parameters<typeof stubAssist>[1] = {}): Promise<AssistCtl> {
  await signInAs(page, "reviewer");
  const ctl = await stubAssist(page, init);
  await page.goto(URL);
  await page.getByRole("button", { name: "Select text" }).click();
  await expect(page.getByRole("region", { name: "AI assist" })).toBeVisible();
  return ctl;
}
const panel = (page: Page) => page.getByRole("region", { name: "AI assist" });
const askBtn = (page: Page) => panel(page).getByRole("button", { name: "Ask for a suggestion" });
async function ask(page: Page) {
  await expect(askBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  await askBtn(page).click();
}
/** Writes since the panel opened: the list read is allowed, nothing else but the failing call. */
const writes = (ctl: AssistCtl) => ctl.requests.filter((r) => r.method !== "GET");

test("states: panel shows the quote, My note, the warn line and Ask; no sparkle", async ({ page }) => {
  await open(page);
  await expect(panel(page).getByRole("heading", { name: "Rewrite selection" })).toBeVisible();
  await expect(panel(page).getByText(SELECTED)).toBeVisible();
  await expect(panel(page).getByLabel("My note")).toBeVisible();
  await expect(panel(page).getByText(WARN)).toBeVisible();
  await expect(askBtn(page)).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Back to the rail" })).toBeVisible();
  await expect(panel(page).locator("svg[data-glyph=sparkle], svg[data-glyph=star]")).toHaveCount(0);
  expect(await panel(page).innerText()).not.toMatch(/sparkle|✨/i);
});

test("states: a returned suggestion shows the rewrite with Accept and Reject", async ({ page }) => {
  const ctl = await open(page);
  await panel(page).getByLabel("My note").fill("Make it a question.");
  await ask(page);
  await expect(panel(page).getByText(onePending.suggested_text)).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Accept" })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Reject" })).toBeVisible();
  expect(await panel(page).innerText()).not.toMatch(/sparkle|✨/i);
  const post = writes(ctl)[0]!;
  expect(post.body).toEqual({ anchor: onePending.anchor, selected_text: SELECTED, note: "Make it a question." });
});

test("pending: a pending suggestion is shown again after reload and puts the reason in Submit", async ({ page }) => {
  await open(page, { list: [onePending] });
  await expect(panel(page).getByText(onePending.suggested_text)).toBeVisible();
  await expect(page.getByTestId("submit-reasons")).toContainText(REASON);
  await page.reload();
  await page.getByRole("button", { name: "Select text" }).click();
  await expect(panel(page).getByText(onePending.suggested_text)).toBeVisible();
  await expect(page.getByTestId("submit-reasons")).toContainText(REASON);
  await panel(page).getByRole("button", { name: "Accept" }).click();
  await expect(page.getByTestId("submit-reasons")).not.toContainText(REASON);
});

test("accept: Accept toasts Applied as your edit (AI-assisted).", async ({ page }) => {
  await open(page, { list: [onePending] });
  await panel(page).getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Applied as your edit (AI-assisted).").first()).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Accept" })).toHaveCount(0);
});

test("reject: Reject toasts Discarded.", async ({ page }) => {
  const ctl = await open(page, { list: [onePending] });
  await panel(page).getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Discarded.").first()).toBeVisible();
  expect(writes(ctl).map((r) => r.body)).toEqual([{ decision: "reject" }]);
});

test("errors: ANCHOR_CHANGED shows Text changed, ask again. and applies nothing", async ({ page }) => {
  const ctl = await open(page, { list: [onePending] });
  await respondWithError(page, "decideSuggestion", "ANCHOR_CHANGED");
  await panel(page).getByRole("button", { name: "Accept" }).click();
  await expect(panel(page).getByRole("alert")).toContainText("Text changed, ask again.");
  await expect(panel(page).getByRole("button", { name: "Accept" })).toHaveCount(0);
  await expect(page.getByText("Applied as your edit (AI-assisted).")).toHaveCount(0);
  expect(writes(ctl)).toEqual([]); // the error route answered the only write
});

test("errors: MODEL_UNAVAILABLE shows Couldn't get a suggestion. Nothing changed. and keeps the note", async ({ page }) => {
  const ctl = await open(page);
  await respondWithError(page, "requestSuggestion", "MODEL_UNAVAILABLE");
  await panel(page).getByLabel("My note").fill("Keep this note");
  await ask(page);
  await expect(panel(page).getByRole("alert")).toContainText("Couldn't get a suggestion. Nothing changed.");
  await expect(panel(page).getByLabel("My note")).toHaveValue("Keep this note");
  expect(writes(ctl)).toEqual([]);
});

test("errors: LESSON_LOCKED removes the form", async ({ page }) => {
  const ctl = await open(page);
  await respondWithError(page, "requestSuggestion", "LESSON_LOCKED");
  await ask(page);
  await expect(panel(page).getByText("AI help isn't available on this lesson right now.").first()).toBeVisible();
  await expect(panel(page).getByLabel("My note")).toHaveCount(0);
  await expect(askBtn(page)).toHaveCount(0);
  expect(writes(ctl)).toEqual([]);
});

test("errors: COLLAB_UNAVAILABLE leaves the suggestion pending with a retry", async ({ page }) => {
  const ctl = await open(page, { list: [onePending] });
  await respondWithError(page, "decideSuggestion", "COLLAB_UNAVAILABLE");
  await panel(page).getByRole("button", { name: "Accept" }).click();
  await expect(panel(page).getByRole("alert")).toContainText("collaboration service isn't reachable");
  await expect(panel(page).getByRole("button", { name: "Accept" })).not.toHaveAttribute("aria-disabled", "true");
  await expect(panel(page).getByRole("button", { name: "Reject" })).toBeVisible();
  await expect(page.getByTestId("submit-reasons")).toContainText(REASON);
  expect(writes(ctl)).toEqual([]);
});

test("errors: INVALID_TRANSITION re-reads the list", async ({ page }) => {
  const ctl = await open(page, { list: [onePending] });
  await respondWithError(page, "decideSuggestion", "INVALID_TRANSITION");
  ctl.list = [];
  const reads = ctl.requests.filter((r) => r.method === "GET").length;
  await panel(page).getByRole("button", { name: "Accept" }).click();
  await expect(panel(page).getByRole("alert")).toContainText("already decided");
  await expect(panel(page).getByRole("button", { name: "Accept" })).toHaveCount(0);
  expect(ctl.requests.filter((r) => r.method === "GET").length).toBe(reads + 1);
  expect(writes(ctl)).toEqual([]);
});

test("no-direct-apply: Accept sends one decideSuggestion request and no document write", async ({ page }) => {
  const evil = { ...onePending, suggested_text: "<script>alert(1)</script>Hi" };
  const collab: string[] = [];
  page.on("request", (r) => /collab|\/doc\/|:4020/.test(r.url()) && collab.push(r.url()));
  const ctl = await open(page, { list: [evil] });
  await expect(panel(page).getByText("<script>alert(1)</script>Hi")).toBeVisible();
  expect(await page.locator("script", { hasText: "alert" }).count()).toBe(0);
  const before = ctl.requests.length;
  await panel(page).getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Applied as your edit (AI-assisted).").first()).toBeVisible();
  const after = ctl.requests.slice(before);
  expect(after).toHaveLength(1);
  expect(after[0]!.method).toBe("POST");
  expect(after[0]!.path).toMatch(/\/lessons\/G6\.U4\.L5\/suggestions\/sug-4-1\/decision$/);
  expect(after[0]!.body).toEqual({ decision: "accept", anchored_text_now: SELECTED });
  expect(collab).toEqual([]);
});

type State = "main" | "suggestion" | "error-anchor-changed";
async function reach(page: Page, state: State) {
  if (state === "main") await open(page);
  else if (state === "suggestion") await open(page, { list: [onePending] });
  else {
    await open(page, { list: [onePending] });
    await respondWithError(page, "decideSuggestion", "ANCHOR_CHANGED");
    await panel(page).getByRole("button", { name: "Accept" }).click();
    await expect(panel(page).getByRole("alert")).toContainText("Text changed, ask again.");
  }
}

for (const state of ["main", "suggestion", "error-anchor-changed"] as const) {
  for (const [w, h] of [[1280, 900], [390, 844]] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`assist ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await reach(page, state);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.evaluate(() => document.fonts.ready);
        const results = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        console.log(`axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`);
        await page.screenshot({ path: path.join(SHOTS, `assist-${state}-${w}-${theme}.png`), fullPage: true });
        expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      });
    }
  }
}
