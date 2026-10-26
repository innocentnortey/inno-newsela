import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { apiGlob, signInAs } from "../../src/test-utils/sign-in-as";
import type { Role } from "../../src/lib/roles";
import {
  HASH_A, HASH_B, SV_A, issuesNone, lesson4InReview, lesson4Submitted, lesson5Approved, lesson5Changed, lesson5Submitted,
} from "./fixtures";
import { errorReply, stubApproval, type Ctl } from "./stubs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const URL5 = "/units/g6-u4/lessons/L5/approve";
const URL4 = "/units/g6-u4/lessons/L4/approve";
const SHOTS = "e2e/__screenshots__/approval";
const FOUR_EYES_TEXT = "Someone else must approve: you were the last editor of this lesson (including AI accepts and adopted candidates).";

test.use({ timezoneId: "UTC", locale: "en-US" });

async function open(page: Page, init: Parameters<typeof stubApproval>[1] = {}, opts: { role?: Role; url?: string } = {}): Promise<Ctl> {
  await signInAs(page, opts.role ?? "approver");
  const ctl = await stubApproval(page, init);
  await page.goto(opts.url ?? URL5);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return ctl;
}
const approveBtn = (page: Page) => page.getByRole("button", { name: "Approve this version" });

test("states: submitted lesson 5 shows checklist, frozen text, pin and four-eyes banner", async ({ page }) => {
  await signInAs(page, "approver");
  const ctl = await stubApproval(page);
  ctl.issuesDelayMs = 800;
  await page.goto(URL5);
  await expect(page.getByRole("heading", { name: "Checklist" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading the lesson text" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lesson text (frozen at 9f3c…a21e)" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading the lesson text" })).toHaveCount(0);
  await expect(page.getByText("Lesson 4 is waiting on this lesson's excerpt.")).toBeVisible();
  await expect(page.getByText("W.6.2.a, W.6.2.b, W.6.2.f confirmed")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Four eyes" })).toBeVisible();
  await expect(page.getByText("You did not edit this lesson, so you can approve it.")).toBeVisible();
  await expect(page.getByText("Draft quality")).toBeVisible();
  await expect(page.getByText("(required)")).toBeVisible();
  await expect(page.getByText("Approving pins snapshot 9f3c…a21e. If it changes before you approve, you'll be asked to reload.")).toBeVisible();
  await page.getByRole("link", { name: "Jump to Learning in Action Part A" }).click();
  await expect(page).toHaveURL(/#sec-G6\.U4\.L5\.LearningInAction\.PartA$/);
  await expect(page.locator("[id='sec-G6.U4.L5.LearningInAction.PartA']")).toBeFocused();
});

test("approve sends the pin once and shows the approved state", async ({ page }) => {
  const ctl = await open(page);
  await page.getByLabel("Usable with edits").check();
  await approveBtn(page).dblclick();
  await expect(page.getByText("Approved by Approver (demo) · pinned 9f3c…a21e · Usable with edits")).toBeVisible();
  expect(ctl.posted).toEqual([{ action: "approve", snapshot_hash: HASH_A, snapshot_state_vector: SV_A, rating: "usable_with_edits" }]);
  await expect(page.getByText("Lesson 5 approved.")).toBeVisible();
  await expect(page.getByText("Lesson 4 can now be approved.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Approved" }).first()).toHaveAttribute("aria-current", "step");
});

test("rating required client and server", async ({ page }) => {
  const ctl = await open(page);
  await approveBtn(page).click();
  await expect(page.getByText("Choose a rating to approve.")).toBeVisible();
  await expect(page.getByLabel("Usable as drafted")).toBeFocused();
  expect(ctl.posted).toHaveLength(0);
  ctl.transition = () => errorReply("RATING_REQUIRED");
  await page.getByLabel("Rewritten").check();
  await approveBtn(page).click();
  await expect(page.getByText("Choose a rating to approve.")).toBeVisible();
  await expect(page.getByLabel("Usable as drafted")).toBeFocused();
  expect(ctl.posted).toHaveLength(1);
});

test("stale-pin reload", async ({ page }) => {
  const ctl = await open(page);
  ctl.transition = () => errorReply("STALE_PIN");
  await page.getByLabel("Usable as drafted").check();
  await approveBtn(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "This lesson changed since you opened it. Reload." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload" })).toBeFocused();
  await expect(approveBtn(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByLabel("Usable as drafted")).toBeDisabled();
  ctl.lesson = lesson5Changed();
  ctl.transition = () => ({ status: 200, json: { lesson_id: "G6.U4.L5", from_state: "submitted", to_state: "approved", version: { version_id: "lv-5-3", version_number: 3, content_hash: HASH_B, state_vector: SV_A }, audit_id: "aud-1", dependency_record: [], metrics_row_written: true } });
  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("heading", { name: "Lesson text (frozen at 7b1d…c0de)" })).toBeVisible();
  await expect(page.getByText("9f3c…a21e")).toHaveCount(0);
  await expect(page.getByLabel("Usable as drafted")).toBeChecked();
  await approveBtn(page).click();
  await expect(page.getByText(/Approved by Approver \(demo\) · pinned 7b1d…c0de/)).toBeVisible();
  expect((ctl.posted.at(-1) as { snapshot_hash: string }).snapshot_hash).toBe(HASH_B);
});

test.describe("refusals", () => {
  test("FOUR_EYES keeps Request changes", async ({ page }) => {
    await signInAs(page, "approver");
    await stubApproval(page);
    await respondWithError(page, "transitionLesson", "FOUR_EYES", { user_id: "u-app-1" });
    await page.goto(URL5);
    await page.getByLabel("Usable as drafted").check();
    await approveBtn(page).click();
    await expect(page.getByText(FOUR_EYES_TEXT)).toBeVisible();
    await expect(approveBtn(page)).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("button", { name: "Request changes" })).not.toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("listitem").filter({ hasText: "Submitted" }).first()).toHaveAttribute("aria-current", "step");
  });

  test("DEPENDENCY_UNAPPROVED shows the Homework row and a link", async ({ page }) => {
    await signInAs(page, "approver");
    await stubApproval(page, { lesson: lesson4Submitted() });
    await respondWithError(page, "transitionLesson", "DEPENDENCY_UNAPPROVED", { source_lesson_ids: ["G6.U4.L5"], message: "G6.U4.L5 must be approved first" });
    await page.goto(URL4);
    await expect(page.getByText("Homework text — Lesson 5 must be approved first")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Lesson 5" })).toHaveAttribute("href", URL5);
    await expect(approveBtn(page)).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("Lesson 5 must be approved first", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Request changes" })).not.toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("listitem").filter({ hasText: "Submitted" }).first()).toHaveAttribute("aria-current", "step");
  });

  test("blocked approve keeps SCR-14 (F-5)", async ({ page }) => {
    await signInAs(page, "approver");
    await stubApproval(page);
    // The server's issue_json carries no `blocks` and no issue_id: the screen must not throw on it.
    const issue = { kind: "standard_confirmation", level: "confirmation", message: "L.6.4.b is AI-proposed: confirm or remove", address: null, code: "L.6.4.b", related_lesson_id: null, resolved: false };
    await respondWithError(page, "transitionLesson", "BLOCKED", { issues: [issue] });
    await page.goto(URL5);
    await page.getByLabel("Usable with edits").check();
    await approveBtn(page).click();
    await expect(page.getByText("Approve refused: L.6.4.b is AI-proposed: confirm or remove.")).toBeVisible();
    await expect(page.getByText("This page couldn't load")).toHaveCount(0);
    await expect(page.getByLabel("Usable with edits")).toBeChecked();
    await expect(page.getByRole("heading", { name: "Checklist" })).toBeVisible();
  });

  test("BLOCKED flips the standards row", async ({ page }) => {
    await signInAs(page, "approver");
    await stubApproval(page);
    const issue = { issue_id: "iss-1", level: "blocking", blocks: ["approve"], kind: "standard_not_checked", message: "RL.6.2 has no checking item", address: null, related_lesson_id: null, resolved: false };
    await respondWithError(page, "transitionLesson", "BLOCKED", { issues: [issue] });
    await page.goto(URL5);
    await page.getByLabel("Rewritten").check();
    await approveBtn(page).click();
    await expect(page.getByText("Approve refused: RL.6.2 has no checking item.")).toBeVisible();
    await expect(page.locator("li[data-state='blocking']").filter({ hasText: "Standards taught and checked" })).toContainText("Blocking");
    await expect(page.getByRole("button", { name: "Request changes" })).not.toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("listitem").filter({ hasText: "Submitted" }).first()).toHaveAttribute("aria-current", "step");
  });
});

test("network error keeps the rating", async ({ page }) => {
  await signInAs(page, "approver");
  await stubApproval(page);
  await page.route(apiGlob("/lessons/*/transitions"), (route) => (route.request().method() === "POST" ? route.abort() : route.fallback()));
  await page.goto(URL5);
  await page.getByLabel("Usable with edits").check();
  await approveBtn(page).click();
  await expect(page.getByText("Couldn't reach the server. Your rating is kept. Try again.")).toBeVisible();
  await expect(page.getByLabel("Usable with edits")).toBeChecked();
});

for (const role of ["author", "reviewer"] as const) {
  test(`roles: ${role} sees no decision controls`, async ({ page }) => {
    await open(page, {}, { role });
    await expect(page.getByText("Only approvers can approve")).toBeVisible();
    await expect(page.getByRole("button", { name: /Approve this version|Request changes|Reopen/ })).toHaveCount(0);
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /approve all|bulk|select all/i })).toHaveCount(0);
  });
}

test("other-states: in-review lesson 4 is not submitted", async ({ page }) => {
  await open(page, { lesson: lesson4InReview() }, { url: URL4 });
  await expect(page.getByText("Lesson 4 isn't submitted yet. It's in review with M. Okafor.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Lesson 4 read-only" })).toHaveAttribute("href", "/units/g6-u4/lessons/L4");
  await expect(page.getByRole("heading", { name: "Your decision" })).toHaveCount(0);
  await expect(approveBtn(page)).toHaveCount(0);
});

test("other-states: approved lesson 5 shows the frozen card", async ({ page }) => {
  const history = { versions: [], ai_spans: [], audit: [{ at: "2026-10-25T10:00:00Z", user: "D. Park", action: "approve", from_state: "submitted", to_state: "approved", version_hash: HASH_A, reason: null }] } as Ctl["history"];
  await open(page, { lesson: lesson5Approved(), history });
  await expect(page.getByText("Approved by D. Park on 2026-10-25")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen…" })).toBeVisible();
  await page.unroute(apiGlob("/session"));
  await signInAs(page, "reviewer");
  await page.reload();
  await expect(page.getByText("Approved by D. Park on 2026-10-25")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen…" })).toHaveCount(0);
});

type State = "main" | "stale-pin" | "four-eyes" | "dependency" | "blocked" | "rating-required" | "not-submitted" | "approved" | "reviewer";
const STATES: State[] = ["main", "stale-pin", "four-eyes", "dependency", "blocked", "rating-required", "not-submitted", "approved", "reviewer"];
const BLOCKING_ISSUE = { issue_id: "iss-1", level: "blocking", blocks: ["approve"], kind: "standard_not_checked", message: "RL.6.2 has no checking item", address: null, related_lesson_id: null, resolved: false };

async function reach(page: Page, state: State): Promise<void> {
  const role: Role = state === "reviewer" ? "reviewer" : "approver";
  await signInAs(page, role);
  const lesson = state === "dependency" ? lesson4Submitted() : state === "not-submitted" ? lesson4InReview() : state === "approved" ? lesson5Approved() : undefined;
  const ctl = await stubApproval(page, lesson ? { lesson, issues: issuesNone(lesson.lesson_id) } : {});
  const codeFor: Partial<Record<State, [Parameters<typeof errorReply>[0], Record<string, unknown>]>> = {
    "stale-pin": ["STALE_PIN", {}], "four-eyes": ["FOUR_EYES", { user_id: "u-app-1" }], blocked: ["BLOCKED", { issues: [BLOCKING_ISSUE] }],
    "rating-required": ["RATING_REQUIRED", {}],
  };
  const err = codeFor[state];
  if (err) ctl.transition = () => errorReply(err[0], err[1]);
  await page.goto(state === "dependency" || state === "not-submitted" ? URL4 : URL5);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  if (state === "approved") await expect(page.getByText(/Approved by/).first()).toBeVisible();
  else if (state !== "not-submitted") await expect(page.getByRole("heading", { name: /Lesson text/ })).toBeVisible();
  if (state === "stale-pin" || state === "four-eyes" || state === "blocked") {
    await page.getByLabel("Usable as drafted").check();
    await approveBtn(page).click();
    await expect(page.getByRole("alert").filter({ hasText: /\w/ }).or(page.getByText(FOUR_EYES_TEXT)).first()).toBeVisible();
  }
  if (state === "rating-required") {
    await approveBtn(page).click();
    await expect(page.getByText("Choose a rating to approve.")).toBeVisible();
  }
}

for (const state of STATES) {
  for (const [w, h] of [[1280, 900], [390, 844]] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`approval ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await reach(page, state);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.evaluate(() => document.fonts.ready);
        const results = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        console.log(`axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`);
        expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        if (state === "main" || state === "stale-pin") {
          await page.screenshot({ path: `${SHOTS}/approval-${state}-${w}-${theme}.png`, fullPage: true });
        }
      });
    }
  }
}

// CHG-3: the approver path SCR-14 -> SCR-15 sends the pin it read; the server may refuse it as STALE_PIN.
const moved = (from: string, to: string, n: number, audit: string) => ({
  status: 200,
  json: { lesson_id: "G6.U4.L5", from_state: from, to_state: to, version: { version_id: `lv-5-${n}`, version_number: n, content_hash: HASH_A, state_vector: SV_A }, audit_id: audit },
});
const sendBackDlg = (page: Page, name: string) => page.getByRole("dialog", { name });

test("approver requests changes from the decision card, pin included", async ({ page }) => {
  const ctl = await open(page);
  await page.getByRole("button", { name: "Request changes", exact: true }).click();
  const d = sendBackDlg(page, "Request changes to Lesson 5");
  await expect(d).toBeVisible();
  await d.getByLabel("Standards").check();
  await d.getByLabel("Note").fill("Check the standards codes in Look Back.");
  ctl.transition = () => {
    ctl.lesson = { ...lesson5Submitted(), state: "changes_requested" };
    return moved("submitted", "changes_requested", 2, "aud-0151");
  };
  await d.getByRole("button", { name: "Send back" }).click();
  await expect(page.getByText("Sent back to J. Rivera.")).toBeVisible();
  expect(ctl.posted).toEqual([
    { action: "request_changes", tag: "standards", note: "Check the standards codes in Look Back.", snapshot_hash: HASH_A, snapshot_state_vector: SV_A },
  ]);
  await expect(page.getByText(/Writing · Changes requested/)).toBeVisible();
});

test("approver reopens an approved lesson from the decision card, pin included", async ({ page }) => {
  const ctl = await open(page, { lesson: lesson5Approved() });
  await page.getByRole("button", { name: "Reopen…" }).click();
  const d = sendBackDlg(page, "Reopen Lesson 5");
  await expect(d).toBeVisible();
  await d.getByLabel("Reason").fill("A rights question came up.");
  ctl.transition = () => {
    ctl.lesson = { ...lesson5Approved(), state: "reopened" };
    return moved("approved", "reopened", 3, "aud-0152");
  };
  await d.getByRole("button", { name: "Reopen", exact: true }).click();
  await expect(page.getByText("Lesson 5 reopened as version 3.")).toBeVisible();
  expect(ctl.posted).toEqual([{ action: "reopen", reason: "A rights question came up.", snapshot_hash: HASH_A, snapshot_state_vector: SV_A }]);
  await expect(page.getByText(/Writing · Reopened/)).toBeVisible();
});

test("a stale pin on send back is refused: server answer and client pre-check", async ({ page }) => {
  const ctl = await open(page);
  await page.getByRole("button", { name: "Request changes", exact: true }).click();
  let d = sendBackDlg(page, "Request changes to Lesson 5");
  await d.getByLabel("Other").check();
  await d.getByLabel("Note").fill("x");
  ctl.transition = () => errorReply("STALE_PIN");
  await d.getByRole("button", { name: "Send back" }).click();
  await expect(d).toBeHidden();
  await expect(page.getByText("This lesson changed since you opened it. Reload.").first()).toBeVisible();
  expect(ctl.posted).toHaveLength(1);
  expect(ctl.lesson.state).toBe("submitted");

  // Pre-check path: the lesson changes after the screen opened; nothing is posted.
  const ctl2 = await open(page);
  await page.getByRole("button", { name: "Request changes", exact: true }).click();
  d = sendBackDlg(page, "Request changes to Lesson 5");
  await d.getByLabel("Other").check();
  await d.getByLabel("Note").fill("x");
  ctl2.lesson = lesson5Changed();
  await d.getByRole("button", { name: "Send back" }).click();
  await expect(d).toBeHidden();
  await expect(page.getByText("This lesson changed since you opened it. Reload.").first()).toBeVisible();
  expect(ctl2.posted).toHaveLength(0);
});
