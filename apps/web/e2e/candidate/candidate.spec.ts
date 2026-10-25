import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import type { Role } from "../../src/lib/roles";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { signInAs } from "../../src/test-utils/sign-in-as";
import { CAND_FAILED, CAND_ID, SECTION_LOOK_BACK } from "./fixtures";
import { serveCandidate, type ServeOpts } from "./serve";

// Playwright compiles specs to CommonJS, where import.meta is a syntax error, so the screenshot folder comes from the
// project config (testDir) rather than import.meta.dirname. No process.cwd(), no __dirname.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const URL4 = `/units/g6-u4/lessons/L4/candidates/${CAND_ID}`;
const LOCKED = "Lesson 4 is submitted. Withdraw it first to regenerate.";

test.use({ timezoneId: "UTC", locale: "en-US" });

async function open(page: Page, opts: ServeOpts & { role?: Role; url?: string; width?: number } = {}) {
  await page.setViewportSize({ width: opts.width ?? 1280, height: opts.width === 390 ? 844 : 900 });
  await signInAs(page, opts.role ?? "reviewer");
  const calls = await serveCandidate(page, opts);
  await page.goto(opts.url ?? URL4);
  return calls;
}
const adoptBtns = (page: Page) => page.getByRole("button", { name: /Adopt/ });
const lookBackBtn = (page: Page) => page.getByRole("button", { name: "Adopt this section: Look Back" });

test("states: ready candidate aligned sheets 1280", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 1, name: "Candidate v4 · not adopted" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Current: Look Back" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Candidate v4: Look Back" })).toBeVisible();
  await expect(page.getByText("Write one sentence.")).toBeVisible();
  await expect(page.getByText("Write two sentences about how Percy sounds.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Adopt this section/ })).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Adopt whole candidate" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Leave unadopted" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
});

test("states: ready candidate tabs 390", async ({ page }) => {
  await open(page, { width: 390 });
  await expect(page.getByRole("tab")).toHaveText(["Current", "Candidate"]);
  await expect(page.getByText("Write two sentences about how Percy sounds.")).toBeVisible();
  await page.getByRole("tab", { name: "Current" }).click();
  await expect(page.getByText("Write one sentence.")).toBeVisible();
});

test("states: ?section scrolls", async ({ page }) => {
  await open(page, { url: `${URL4}?section=${SECTION_LOOK_BACK}`, width: 390 });
  await expect(page.locator(`[id='cmp-${SECTION_LOOK_BACK}']`)).toBeInViewport();
});

test("drafting: shows the sentence then the ready view", async ({ page }) => {
  await open(page, { readyAfterPolls: 2 });
  await expect(page.getByText("Drafting a candidate… The current lesson is unchanged.")).toBeVisible();
  await expect(adoptBtns(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adopt whole candidate" })).toBeVisible({ timeout: 15_000 });
});

test("failed: Look Back sentence", async ({ page }) => {
  await open(page, { readyAfterPolls: 0, candidate: CAND_FAILED });
  await expect(page.getByText("Candidate failed: Look Back is 3 minutes (needs 5). The current lesson is unchanged.")).toBeVisible();
  await expect(adoptBtns(page)).toHaveCount(0);
});

test("adopt: one section then whole", async ({ page }) => {
  const calls = await open(page);
  await lookBackBtn(page).click();
  await expect(page.getByText("Adopted by J. Rivera")).toHaveCount(1);
  await expect(page.getByText("Look Back adopted from candidate v4. Logged as your edit.").first()).toBeVisible();
  await expect(lookBackBtn(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Adopt whole candidate" }).click();
  await expect(page).toHaveURL(/\/units\/g6-u4\/lessons\/L4$/, { timeout: 10_000 });
  expect(calls.adopts).toEqual([{ scope: "section", section_address: SECTION_LOOK_BACK }, { scope: "whole" }]);
  const handoff = await page.evaluate(() => sessionStorage.getItem("ls.handoff-toast"));
  expect(handoff).toContain("Candidate v4 adopted. Logged as your edit.");
});

const ERRORS = [
  ["LESSON_LOCKED", LOCKED],
  ["DAY_CAP_REACHED", "Daily spend cap reached. No candidate was made."],
  ["INVALID_TRANSITION", null],
  ["COLLAB_UNAVAILABLE", "Nothing changed. Try again."],
] as const;
for (const [code, sentence] of ERRORS) {
  test(`errors: ${code}`, async ({ page }) => {
    await signInAs(page, "reviewer");
    await serveCandidate(page);
    await respondWithError(page, "adoptCandidate", code);
    await page.goto(URL4);
    await lookBackBtn(page).click();
    if (sentence) await expect(page.getByText(sentence)).toBeVisible();
    else await expect(lookBackBtn(page)).toBeEnabled();
    await expect(page.getByText(/Adopted by/)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${CAND_ID}$`));
  });
}

test("roles: author and approver see no adopt control", async ({ page }) => {
  for (const role of ["author", "approver"] as const) {
    await open(page, { role });
    await expect(page.getByText("Write two sentences about how Percy sounds.")).toBeVisible();
    await expect(page.getByText("Only reviewers adopt candidates")).toBeVisible();
    await expect(adoptBtns(page)).toHaveCount(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("roles: reviewer sees the HP-5 note", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("hp5-note")).toHaveText("Copying text by hand from the candidate is not tracked as an adoption.");
});

type State = "ready" | "drafting" | "failed" | "error-locked" | "readonly";
const STATES: State[] = ["ready", "drafting", "failed", "error-locked", "readonly"];

async function reach(page: Page, state: State, width: number) {
  const base = { width };
  if (state === "drafting") await open(page, { ...base, readyAfterPolls: 999 });
  else if (state === "failed") await open(page, { ...base, candidate: CAND_FAILED });
  else if (state === "readonly") await open(page, { ...base, role: "author" });
  else if (state === "error-locked") {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await signInAs(page, "reviewer");
    await serveCandidate(page);
    await respondWithError(page, "adoptCandidate", "LESSON_LOCKED");
    await page.goto(URL4);
    await lookBackBtn(page).click();
    await expect(page.getByText(LOCKED)).toBeVisible();
  } else await open(page, base);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
  if (state === "ready" || state === "readonly") await expect(page.getByTestId("hp5-note")).toBeVisible();
}

for (const state of STATES) {
  for (const w of [1280, 390]) {
    for (const theme of ["light", "dark"] as const) {
      test(`candidate ${state} ${w} ${theme} @axe`, async ({ page }, testInfo) => {
        await reach(page, state, w);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.evaluate(() => document.fonts.ready);
        const results = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        console.log(`axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`);
        expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        if (state === "ready" || state === "error-locked") {
          await page.screenshot({ path: path.join(testInfo.project.testDir, "__screenshots__", "candidate", `candidate-${state}-${w}-${theme}.png`), fullPage: true });
        }
      });
    }
  }
}
