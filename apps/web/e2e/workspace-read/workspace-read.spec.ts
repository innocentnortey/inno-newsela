import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Role } from "../../src/lib/roles";
import { mockOperation } from "../../src/test-utils/mock-operation";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { signInAs } from "../../src/test-utils/sign-in-as";
import { lessonWith } from "./fixtures";
import { passPageThrough, serveLesson } from "./serve";

const URL4 = "/units/g6-u4/lessons/L4";
const PART_A = "G6.U4.L4.LearningInAction.PartA";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const axe = (page: Page) => new AxeBuilder({ page: page as unknown as AxePage });
const SHOTS = "e2e/__screenshots__/workspace-read";

async function open(page: Page, role: Role = "author", url = URL4) {
  await signInAs(page, role);
  await passPageThrough(page);
  await page.goto(url);
}

async function focusedInPartA(page: Page) {
  await expect
    .poll(() =>
      page.evaluate((addr) => {
        const a = document.activeElement;
        return !!a && !!a.closest(`[data-address="${addr}"]`) && !!a.closest('[data-testid="lesson-text"]');
      }, PART_A),
    )
    .toBe(true);
}

test("states: loading shows skeleton then lesson", async ({ page }) => {
  await serveLesson(page, { delayMs: 800 });
  await open(page);
  await expect(page.getByTestId("workspace-skeleton")).toBeVisible();
  await expect(page.getByTestId("skeleton-outline-item")).toHaveCount(5);
  await expect(page.getByTestId("skeleton-line")).toHaveCount(8);
  await expect(page.getByTestId("skeleton-issue")).toHaveCount(3);
  await expect(page.getByRole("heading", { level: 1, name: "Lesson 4: The Lightning Thief, Chapter 1" })).toBeVisible();
  await expect(page.getByTestId("text-card")).toContainText("9780786838653");
  await expect(page.getByTestId("text-card")).toContainText("off-platform-text");
  await expect(page.getByTestId("lesson-text")).toContainText("short-quote-commentary");
  const nav = page.getByRole("navigation", { name: "Lesson sections" });
  await expect(nav).toContainText("Sections · 50 min");
  await expect(nav.getByRole("button", { name: /Learning in Action/ })).toContainText("30");
});

test("states: prism example opens", async ({ page }) => {
  await mockOperation(page, "getLesson", { example: "lesson4" });
  await open(page);
  await expect(page.getByRole("heading", { level: 1, name: /The Lightning Thief/ })).toBeVisible();
});

test("jump: card focuses the span", async ({ page }) => {
  await serveLesson(page);
  await open(page);
  await page.getByRole("button", { name: /Go to issue 1: quote placeholder open/ }).click();
  await focusedInPartA(page);
});

test("jump: deep links", async ({ page }) => {
  await serveLesson(page);
  await open(page, "author", `${URL4}?issue=iss-4-1`);
  await focusedInPartA(page);
  await expect(page.getByRole("button", { name: /Go to issue 1/ })).toHaveAttribute("aria-current", "true");
  await page.goto(`${URL4}?at=${PART_A}`);
  await focusedInPartA(page);
  await page.goto(`${URL4}?tab=standards`);
  await expect(page.getByRole("tab", { name: /Standards/ })).toHaveAttribute("data-state", "active");
});

test("jump: bracket keys step issues", async ({ page }) => {
  await serveLesson(page);
  await open(page);
  await expect(page.getByRole("button", { name: /Go to issue 1/ })).toBeVisible();
  await page.locator("body").press("]");
  await focusedInPartA(page);
  await page.locator("body").press("]");
  await expect(page.getByRole("button", { name: /Go to issue 2/ })).toHaveAttribute("aria-current", "true");
  await page.locator("body").press("[");
  await focusedInPartA(page);
});

test("rail: standards and outline row", async ({ page }) => {
  await serveLesson(page);
  await open(page);
  await page.getByRole("tab", { name: /Standards/ }).click();
  const rail = page.getByRole("complementary", { name: "Evidence" });
  await expect(rail).toContainText("L.6.4.b");
  await expect(rail).toContainText("AI-proposed · confirm");
  await expect(rail).toContainText("taught:");
  await expect(rail).toContainText("checked:");
  await expect(rail).toContainText("asserted by");
  await page.getByRole("button", { name: /L\.6\.4\.b/ }).click();
  await expect(rail.locator("blockquote")).toContainText("Greek or Latin affixes");
  await page.getByRole("tab", { name: "Outline row" }).click();
  await expect(rail).toContainText("editor note");
  await expect(rail).toContainText("default");
});

for (const state of ["submitted", "approved", "changes_requested", "reopened"] as const) {
  test(`banners: ${state} as reviewer`, async ({ page }) => {
    const patch =
      state === "approved"
        ? { snapshot: { version_id: "v-1", content_hash: LESSON_HASH, state_vector: "AQ==" } }
        : state === "changes_requested" || state === "reopened"
          ? { send_back: { tag: "standards" as const, note: "Re-check L.6.4.b.", by: "D. Park", at: "2026-10-25T16:00:00Z" } }
          : {};
    await serveLesson(page, { lesson: lessonWith(state, patch) });
    await open(page, "reviewer");
    const banner = page.getByTestId("state-banner");
    await expect(banner).toBeVisible();
    if (state === "submitted") await expect(banner).toContainText("Submitted: waiting for approval");
    if (state === "approved") await expect(banner).toContainText("Approved · v1 · pinned 9f00…0405");
    if (state === "changes_requested") await expect(banner).toContainText("Changes requested by D. Park");
    if (state === "reopened") await expect(banner).toContainText("Reopened by D. Park");
    await expect(page.getByTestId("role-note")).toHaveCount(0);
  });
}
const LESSON_HASH = "9f00000000000000000000000000000000000000000000000000000000000405";

for (const role of ["author", "approver"] as const) {
  test(`banners: role note as ${role}`, async ({ page }) => {
    await serveLesson(page);
    await open(page, role);
    await expect(page.getByTestId("role-note")).toContainText(`You're viewing as ${role === "author" ? "an author" : "an approver"}. Only reviewers edit lessons.`);
    await expect(page.getByRole("toolbar")).toHaveCount(0);
    await expect(page.getByTestId("editor-mount")).toHaveCount(0);
  });
}

test("errors: schema unknown", async ({ page }) => {
  await respondWithError(page, "getLesson", "SCHEMA_UNKNOWN", { lesson_id: "G6.U4.L4", schema_version: 3 });
  await open(page);
  await expect(page.getByRole("alert").filter({ hasText: "won't open" })).toHaveText(
    "Lesson 4 won't open. It uses schema version 3, which this app doesn't know yet. Nothing has been dropped.Back to the board",
  );
  await expect(page.getByRole("link", { name: "Back to the board" })).toBeVisible();
  await expect(page.getByTestId("lesson-text")).toHaveCount(0);
});

test("errors: cant load", async ({ page }) => {
  await respondWithError(page, "getLesson", "SERVICE_BUSY");
  await open(page);
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("errors: not found", async ({ page }) => {
  await respondWithError(page, "getLesson", "NOT_FOUND");
  await open(page, "reviewer", "/units/g6-u4/lessons/L48");
  await expect(page.getByText("There is no Lesson 48 in Grade 6 · Unit 4")).toBeVisible();
});

test("no horizontal scroll at 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await serveLesson(page);
  await open(page);
  await expect(page.getByTestId("lesson-text")).toBeVisible();
  // Scoped to this screen: the frame's top bar (user menu) is 451px wide at 390 and is not ours (reported to the integrator).
  const overflow = await page.evaluate(
    () => [...document.querySelectorAll('[data-slot="content"] *, [data-slot="rail"] *')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).length,
  );
  expect(overflow).toBe(0);
});

// The reviewer on an editable lesson gets the live editor (S-17); these specs read the lesson as an author.
// ---- axe: one pass per state, size and theme (@axe) ----
type Setup = (page: Page) => Promise<void>;
const STATES: { name: string; role?: Role; url?: string; setup: Setup; ready: (p: Page) => Promise<void>; shot?: boolean }[] = [
  { name: "loading", setup: (p) => serveLesson(p, { delayMs: 60_000 }), ready: (p) => expect(p.getByTestId("workspace-skeleton")).toBeVisible() as Promise<void> },
  { name: "in_review", role: "author", setup: (p) => serveLesson(p), ready: (p) => expect(p.getByTestId("lesson-text")).toBeVisible() as Promise<void>, shot: true },
  { name: "generation_failed", setup: (p) => serveLesson(p, { lesson: lessonWith("generation_failed") }), ready: (p) => expect(p.getByTestId("state-banner")).toBeVisible() as Promise<void> },
  { name: "submitted", setup: (p) => serveLesson(p, { lesson: lessonWith("submitted") }), ready: (p) => expect(p.getByTestId("state-banner")).toBeVisible() as Promise<void> },
  { name: "approved", setup: (p) => serveLesson(p, { lesson: lessonWith("approved") }), ready: (p) => expect(p.getByTestId("state-banner")).toBeVisible() as Promise<void> },
  { name: "changes_requested", setup: (p) => serveLesson(p, { lesson: lessonWith("changes_requested", { send_back: { tag: "other", note: "See notes.", by: "D. Park", at: "2026-10-25T16:00:00Z" } }) }), ready: (p) => expect(p.getByTestId("state-banner")).toBeVisible() as Promise<void> },
  { name: "reopened", setup: (p) => serveLesson(p, { lesson: lessonWith("reopened") }), ready: (p) => expect(p.getByTestId("state-banner")).toBeVisible() as Promise<void> },
  { name: "role-note", role: "author", setup: (p) => serveLesson(p), ready: (p) => expect(p.getByTestId("role-note")).toBeVisible() as Promise<void> },
  { name: "schema_unknown", setup: (p) => respondWithError(p, "getLesson", "SCHEMA_UNKNOWN", { lesson_id: "G6.U4.L4", schema_version: 3 }), ready: (p) => expect(p.getByText(/won't open/)).toBeVisible() as Promise<void>, shot: true },
  { name: "cant_load", setup: (p) => respondWithError(p, "getLesson", "SERVICE_BUSY"), ready: (p) => expect(p.getByRole("button", { name: "Retry" })).toBeVisible() as Promise<void> },
  { name: "not_found", url: "/units/g6-u4/lessons/L48", setup: (p) => respondWithError(p, "getLesson", "NOT_FOUND"), ready: (p) => expect(p.getByText(/There is no Lesson 48/)).toBeVisible() as Promise<void> },
];

for (const s of STATES) {
  for (const { w, h } of [{ w: 1280, h: 900 }, { w: 390, h: 844 }]) {
    for (const theme of ["light", "dark"] as const) {
      test(`@axe ${s.name} ${w} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await s.setup(page);
        await open(page, s.role ?? "reviewer", s.url);
        await s.ready(page);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.evaluate(() => document.fonts.ready);
        const res = await axe(page).withTags(TAGS).analyze();
        const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        console.log(`axe ${s.name} ${w}x ${theme}: ${bad.length} serious/critical`);
        if (s.shot) await page.screenshot({ path: `${SHOTS}/workspace-read-${s.name}-${w}-${theme}.png`, fullPage: true });
        expect(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
      });
    }
  }
}
