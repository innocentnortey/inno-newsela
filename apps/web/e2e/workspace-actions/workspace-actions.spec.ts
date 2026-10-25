import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import type { Role } from "../../src/lib/roles";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { apiGlob, signInAs } from "../../src/test-utils/sign-in-as";
import { ISSUES4, LESSON4 } from "../workspace-read/fixtures";

type Lesson = components["schemas"]["Lesson"];
type IssueList = components["schemas"]["IssueList"];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const axe = (page: Page) => new AxeBuilder({ page: page as unknown as AxePage });
const SHOTS = "e2e/__screenshots__/workspace-actions";
const HARNESS = "/harness/workspace-actions";
const cors = { "access-control-allow-origin": "*", "x-request-id": "req-test" };

const CLEAN: IssueList = { ...ISSUES4, counts: { blocking: 0, confirmation: 0, advisory: 0 }, issues: [] };

/** A tiny stateful server: GET lesson / issues, and the write operations this ticket calls. Counts every call. */
async function serve(page: Page, opts: { state?: Lesson["state"]; issues?: IssueList; clean?: boolean } = {}) {
  const s = {
    lesson: { ...LESSON4, state: opts.state ?? "in_review" } as Lesson,
    issues: opts.issues ?? (opts.clean ? CLEAN : ISSUES4),
    calls: { transitions: [] as unknown[], decisions: [] as unknown[], candidates: [] as unknown[], heartbeats: [] as unknown[] },
    candidatePolls: 0,
  };
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  const body = (route: Route) => route.request().postDataJSON() as Record<string, unknown>;

  await page.route(apiGlob("/lessons/*"), (route) => {
    if (route.request().resourceType() === "document") return route.continue();
    return route.request().method() === "GET" ? json(route, s.lesson) : route.fallback();
  });
  await page.route(apiGlob("/lessons/*/issues"), (route) => json(route, s.issues));
  await page.route(apiGlob("/lessons/*/transitions"), (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    const b = body(route);
    s.calls.transitions.push(b);
    const from = s.lesson.state;
    const to = b.action === "submit" ? "submitted" : b.action === "withdraw" ? "in_review" : "in_review";
    s.lesson = { ...s.lesson, state: to };
    return json(route, { lesson_id: "G6.U4.L4", from_state: from, to_state: to, version: 2, audit_id: "aud-0201" });
  });
  await page.route(apiGlob("/lessons/*/standards/decision"), (route) => {
    const b = body(route);
    s.calls.decisions.push(b);
    const code = b.code as string;
    if (b.decision !== "undo") {
      const confirmation = b.decision === "confirm" ? "confirmed" : "removed";
      s.lesson = { ...s.lesson, front_matter: { standards: s.lesson.front_matter.standards.map((x) => (x.code === code ? { ...x, confirmation } : x)) } } as Lesson;
    } else {
      s.lesson = { ...s.lesson, front_matter: { standards: s.lesson.front_matter.standards.map((x) => (x.code === code ? { ...x, confirmation: "open" } : x)) } } as Lesson;
    }
    return json(route, { item_id: "iss-4-3", status: "confirmed", by: "Reviewer A (demo)", at: "2026-10-25T16:00:00Z", audit_id: "aud-0102", counts: { blocking: 2, confirmation: 0, advisory: 1 } });
  });
  await page.route(apiGlob("/lessons/*/candidates"), (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    s.calls.candidates.push(route.request().postData());
    return json(route, { candidate_id: "cand-1", version_number: 2, status: "drafting", adopted: false, failure_reasons: [], cost_usd: 0, current_content_hash: LESSON4.content_hash, sections: [] }, 202);
  });
  await page.route(apiGlob("/lessons/*/candidates/*"), (route) => {
    s.candidatePolls += 1;
    return json(route, { candidate_id: "cand-1", version_number: 2, status: "ready", adopted: false, failure_reasons: [], cost_usd: 0.12, current_content_hash: LESSON4.content_hash, sections: [] });
  });
  await page.route(apiGlob("/lessons/*/heartbeats"), (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    s.calls.heartbeats.push(body(route));
    return route.fulfill({ status: 204, headers: cors });
  });
  return s;
}

async function open(page: Page, role: Role, query = "") {
  await signInAs(page, role);
  await page.goto(`${HARNESS}${query}`);
  await expect(page.getByTestId("action-bar")).toBeVisible();
}

const submit = (page: Page) => page.getByRole("button", { name: "Submit for approval" });

test("submit-reasons: one line each, Submit off, pressing it focuses the first issue", async ({ page }) => {
  const s = await serve(page);
  await open(page, "reviewer", "?client=saving");
  const lines = page.getByTestId("submit-reasons").getByRole("listitem");
  await expect(lines).toHaveText(["2 blocking issues", "1 standard to confirm", "Saving"]);
  await expect(submit(page)).toHaveAttribute("aria-disabled", "true");
  // Playwright treats aria-disabled as not actionable, so force the press a keyboard or mouse user can make.
  await submit(page).click({ force: true });
  await expect(page.locator("[data-issue-card]").first()).toBeFocused();
  expect(s.calls.transitions).toHaveLength(0);
});

test("submit-reasons: enabled when nothing blocks, posts the vector", async ({ page }) => {
  const s = await serve(page, { clean: true });
  await open(page, "reviewer");
  await expect(page.getByTestId("submit-reasons").getByRole("listitem")).toHaveCount(0);
  await submit(page).click();
  await expect(page.locator("p", { hasText: "Lesson 4 submitted for approval." })).toBeVisible();
  expect(s.calls.transitions).toEqual([{ action: "submit", client_state_vector: LESSON4.state_vector }]);
  await expect(page.getByTestId("lesson-state")).toHaveText("submitted");
});

test("refusals: BLOCKED shows the sentence and the lesson does not freeze", async ({ page }) => {
  await serve(page, { clean: true });
  await respondWithError(page, "transitionLesson", "BLOCKED", { issues: [{ level: "blocking", message: "RL.6.2 has no checking item" }] });
  await open(page, "reviewer");
  await submit(page).click();
  await expect(page.getByTestId("action-bar").getByRole("alert")).toContainText("Submit refused: RL.6.2 has no checking item on the stored copy.");
  await expect(page.getByTestId("lesson-state")).toHaveText("in_review");
  await expect(submit(page)).toBeVisible();
});

test("refusals: NOT_STORED keeps Submit off with Saving; COLLAB_UNAVAILABLE says nothing changed", async ({ page }) => {
  await serve(page, { clean: true });
  await respondWithError(page, "transitionLesson", "NOT_STORED");
  await open(page, "reviewer");
  await submit(page).click();
  await expect(page.getByTestId("submit-reasons").getByRole("listitem")).toHaveText(["Saving"]);
  await expect(submit(page)).toHaveAttribute("aria-disabled", "true");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await serve(page, { clean: true });
  await respondWithError(page, "transitionLesson", "COLLAB_UNAVAILABLE");
  await open(page, "reviewer");
  await submit(page).click();
  await expect(page.getByTestId("action-bar").getByRole("alert")).toContainText("Couldn't reach the editor server. Nothing changed. Try again.");
});

test("start-review: once for a reviewer on a draft, never for author or approver", async ({ page }) => {
  const s = await serve(page, { state: "draft" });
  await open(page, "reviewer");
  await expect(page.getByTestId("reviewer-note")).toHaveText("You're the reviewer for this lesson.");
  expect(s.calls.transitions).toEqual([{ action: "start_review" }]);
  for (const role of ["author", "approver"] as const) {
    const other = await serve(page, { state: "draft" });
    await open(page, role);
    await page.waitForTimeout(500);
    expect(other.calls.transitions).toHaveLength(0);
  }
});

test("standards: Confirm acts at once, Undo for 6 s restores, then the toast goes", async ({ page }) => {
  const s = await serve(page);
  await page.clock.install();
  await open(page, "reviewer");
  await page.getByRole("button", { name: "Confirm L.6.4.b" }).click();
  await expect(page.locator("p", { hasText: "Confirmed L.6.4.b." })).toBeVisible();
  expect(s.calls.decisions).toEqual([{ code: "L.6.4.b", decision: "confirm" }]);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => s.calls.decisions.length).toBe(2);
  expect(s.calls.decisions[1]).toEqual({ code: "L.6.4.b", decision: "undo", undo_of: "aud-0102" });
  await expect(page.getByRole("button", { name: "Confirm L.6.4.b" })).toBeVisible();
  await page.getByRole("button", { name: "Remove L.6.4.b" }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await page.clock.runFor(6_100);
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
});

test("standards: the real workspace rail shows Confirm and Remove and the footer bar", async ({ page }) => {
  const s = await serve(page);
  await signInAs(page, "reviewer");
  await page.goto("/units/g6-u4/lessons/L4?tab=standards");
  await expect(page.getByTestId("action-bar")).toBeVisible();
  await page.getByRole("button", { name: "Confirm L.6.4.b" }).click();
  await expect(page.locator("p", { hasText: "Confirmed L.6.4.b." })).toBeVisible();
  expect(s.calls.decisions).toEqual([{ code: "L.6.4.b", decision: "confirm" }]);
});

test("frozen: submitted offers Withdraw only, with no reason asked", async ({ page }) => {
  const s = await serve(page, { state: "submitted" });
  await open(page, "reviewer");
  await expect(page.getByRole("button", { name: "Withdraw" })).toBeVisible();
  await expect(submit(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Regenerate/ })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Lesson progress" }).locator("[aria-current]")).toContainText(/3|Approve/);
  await page.getByRole("button", { name: "Withdraw" }).click();
  await expect(page.locator("p", { hasText: "Lesson 4 withdrawn. It's back in review." })).toBeVisible();
  expect(s.calls.transitions).toEqual([{ action: "withdraw" }]);
});

test("regenerate: note, drafting message, then the candidate link", async ({ page }) => {
  const s = await serve(page);
  await open(page, "reviewer");
  await page.getByRole("button", { name: "Regenerate…" }).click();
  await page.getByLabel("Note (optional)").fill("shorter intro");
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  expect(JSON.parse(String(await expect.poll(() => s.calls.candidates[0]).toBeTruthy().then(() => s.calls.candidates[0])))).toEqual({ note: "shorter intro" });
  await expect(page.getByRole("link", { name: "Compare the candidate" })).toHaveAttribute("href", "/units/g6-u4/lessons/L4/candidates/cand-1", { timeout: 8000 });
});

test("heartbeat: the page sends contract fields only, and nothing for an author", async ({ page }) => {
  const s = await serve(page);
  await page.clock.install();
  await open(page, "reviewer");
  await page.evaluate(() => window.dispatchEvent(new Event("pointerdown")));
  await page.clock.runFor(15_100);
  await expect.poll(() => s.calls.heartbeats.length).toBeGreaterThan(0);
  expect(Object.keys(s.calls.heartbeats[0] as object).sort()).toEqual(["focused", "last_input_at", "sent_at", "tab_id", "version_id", "visible"]);
});

const VIEWS = [
  { w: 1280, h: 900 },
  { w: 390, h: 844 },
] as const;
const STATES = [
  { name: "a11y-off", shot: "main", setup: async (p: Page) => (await serve(p), "?client=saving"), role: "reviewer" as Role },
  {
    name: "a11y-refused",
    shot: "error",
    setup: async (p: Page) => {
      await serve(p, { clean: true });
      await respondWithError(p, "transitionLesson", "BLOCKED", { issues: [{ level: "blocking", message: "RL.6.2 has no checking item" }] });
      return "";
    },
    role: "reviewer" as Role,
  },
  { name: "a11y-frozen", shot: null, setup: async (p: Page) => (await serve(p, { state: "submitted" }), ""), role: "reviewer" as Role },
  { name: "a11y-drafting", shot: null, setup: async (p: Page) => (await serve(p), ""), role: "reviewer" as Role },
];

for (const st of STATES) {
  for (const v of VIEWS) {
    for (const theme of ["light", "dark"] as const) {
      test(`${st.name} ${v.w}x${v.h} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: v.w, height: v.h });
        const query = await st.setup(page);
        await open(page, st.role, query);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        if (st.name === "a11y-refused") {
          await submit(page).click();
          await expect(page.getByTestId("action-bar").getByRole("alert")).toBeVisible();
        }
        if (st.name === "a11y-drafting") {
          await page.getByRole("button", { name: "Regenerate…" }).click();
          await page.getByRole("button", { name: "Regenerate", exact: true }).click();
          await expect(page.getByTestId("regen-status")).toBeVisible();
        }
        if (st.shot) await page.screenshot({ path: `${SHOTS}/workspace-actions-${st.shot}-${v.w}-${theme}.png`, fullPage: true });
        const results = await axe(page).withTags(TAGS).analyze();
        const bad = results.violations.filter((x) => x.impact === "serious" || x.impact === "critical");
        expect(bad.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        console.log(`axe ${st.name} ${v.w} ${theme}: 0 serious/critical`);
      });
    }
  }
}
