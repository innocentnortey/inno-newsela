import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiGlob, signInAs } from "../../src/test-utils/sign-in-as";
import type { Role } from "../../src/lib/roles";
import { HASH_A, SV_A, lesson5Approved, lesson5Changed, lesson5Submitted } from "../approval/fixtures";
import { errorReply, stubApproval, type Ctl } from "../approval/stubs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SHOTS = path.join(__dirname, "..", "__screenshots__", "send-back");
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
type Mode = "request_changes" | "reopen";
type Lesson = ReturnType<typeof lesson5Submitted>;

test.use({ timezoneId: "UTC", locale: "en-US" });

const dlgName = (mode: Mode) => (mode === "reopen" ? "Reopen Lesson 5" : "Request changes to Lesson 5");
const sentBack = () => ({
  status: 200,
  json: { lesson_id: "G6.U4.L5", from_state: "submitted", to_state: "changes_requested", version: { version_id: "lv-5-2", version_number: 2, content_hash: HASH_A, state_vector: SV_A }, audit_id: "aud-0151" },
});
const reopened = () => ({
  status: 200,
  json: { lesson_id: "G6.U4.L5", from_state: "approved", to_state: "reopened", version: { version_id: "lv-5-3", version_number: 3, content_hash: HASH_A, state_vector: SV_A }, audit_id: "aud-0152" },
});

async function open(page: Page, mode: Mode, opts: { role?: Role; lesson?: Lesson; theme?: string; openIt?: boolean } = {}) {
  await signInAs(page, opts.role ?? "approver");
  const gets: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "GET" && /\/lessons\/G6\.U4\.L5$/.test(new URL(r.url()).pathname)) gets.push(r.url());
  });
  const ctl: Ctl = await stubApproval(page, { lesson: opts.lesson ?? (mode === "reopen" ? lesson5Approved() : lesson5Submitted()) });
  await page.goto("/harness/send-back");
  if (opts.theme) await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), opts.theme);
  if (opts.openIt === false) return { ctl, gets };
  await page.getByRole("button", { name: mode === "reopen" ? "Reopen…" : "Request changes…" }).click();
  await expect(page.getByRole("dialog", { name: dlgName(mode) })).toBeVisible();
  return { ctl, gets };
}
const dlg = (page: Page, mode: Mode) => page.getByRole("dialog", { name: dlgName(mode) });

test("states: request changes shows seven tags, a required note and the J. Rivera line", async ({ page }) => {
  await open(page, "request_changes");
  const d = dlg(page, "request_changes");
  await expect(d.getByRole("group", { name: "Reason" })).toBeVisible();
  const radios = d.getByRole("radio");
  await expect(radios).toHaveCount(7);
  for (const [i, label] of ["Standards", "Quotes and rights", "ELD support", "Content safety", "AI spans", "Teaching quality", "Other"].entries()) {
    await expect(d.locator("label:has(input[type=radio])").nth(i)).toHaveText(label);
    await expect(radios.nth(i)).not.toBeChecked();
  }
  await expect(d.getByLabel("Note")).toBeVisible();
  await expect(d.getByText("J. Rivera will see your tag and note on the board and in the lesson.")).toBeVisible();
  await expect(d.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(d.getByRole("button", { name: "Send back" })).toBeVisible();
});

test("states: reopen shows a required reason and the Lesson 4 dependants banner", async ({ page }) => {
  await open(page, "reopen");
  const d = dlg(page, "reopen");
  await expect(d.getByLabel("Reason")).toBeVisible();
  await expect(d.getByText("Lesson 4 links to this lesson. It will be flagged and held back from export until Lesson 5 is approved again.")).toBeVisible();
  await expect(d.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(d.getByRole("button", { name: "Reopen" })).toBeVisible();
});

test("states: reopen without dependants shows no banner", async ({ page }) => {
  await open(page, "reopen", { lesson: { ...lesson5Approved(), dependencies: [] } });
  const d = dlg(page, "reopen");
  await expect(d.getByLabel("Reason")).toBeVisible();
  await expect(d.getByText("links to this lesson")).toHaveCount(0);
  await expect(d.getByText("Couldn't check which lessons")).toHaveCount(0);
});

test("submit: send back posts request_changes once and toasts", async ({ page }) => {
  const { ctl, gets } = await open(page, "request_changes");
  ctl.transition = sentBack;
  const d = dlg(page, "request_changes");
  await d.getByLabel("AI spans").check();
  await d.getByLabel("Note").fill("Fix the quote");
  await d.getByRole("button", { name: "Send back" }).dblclick();
  await expect(page.getByText("Sent back to J. Rivera.")).toBeVisible();
  await expect(d).toBeHidden();
  expect(ctl.posted).toEqual([{ action: "request_changes", tag: "ai_spans", note: "Fix the quote" }]);
  expect(gets.length).toBeGreaterThanOrEqual(2);
});

test("submit: reopen posts reopen once and toasts the version", async ({ page }) => {
  const { ctl } = await open(page, "reopen");
  ctl.transition = reopened;
  const d = dlg(page, "reopen");
  await d.getByLabel("Reason").fill("Quote needs rights check");
  await d.getByRole("button", { name: "Reopen" }).dblclick();
  await expect(page.getByText("Lesson 5 reopened as version 3.")).toBeVisible();
  await expect(d).toBeHidden();
  expect(ctl.posted).toEqual([{ action: "reopen", reason: "Quote needs rights check" }]);
});

test("errors: NOTE_REQUIRED shows the sentence and keeps the text", async ({ page }) => {
  const { ctl } = await open(page, "request_changes");
  ctl.transition = () => errorReply("NOTE_REQUIRED");
  const d = dlg(page, "request_changes");
  await d.getByLabel("Other").check();
  await d.getByLabel("Note").fill("keep this");
  await d.getByRole("button", { name: "Send back" }).click();
  await expect(d.getByText("Add a note: say what needs to change.")).toBeVisible();
  await expect(d.getByLabel("Note")).toHaveValue("keep this");
  await expect(d.getByLabel("Note")).toBeFocused();
});

test("errors: an empty note never calls the server", async ({ page }) => {
  const { ctl } = await open(page, "request_changes");
  const d = dlg(page, "request_changes");
  await d.getByLabel("Other").check();
  await d.getByRole("button", { name: "Send back" }).click();
  await expect(d.getByText("Add a note: say what needs to change.")).toBeVisible();
  expect(ctl.posted).toHaveLength(0);
});

test("errors: REASON_REQUIRED shows the sentence and keeps the text", async ({ page }) => {
  const { ctl } = await open(page, "reopen");
  ctl.transition = () => errorReply("REASON_REQUIRED");
  const d = dlg(page, "reopen");
  await d.getByLabel("Reason").fill("keep this");
  await d.getByRole("button", { name: "Reopen" }).click();
  await expect(d.getByText("Add a reason: say why this lesson is being reopened.")).toBeVisible();
  await expect(d.getByLabel("Reason")).toHaveValue("keep this");
});

test("errors: STALE_PIN closes the dialog and shows the reload banner", async ({ page }) => {
  const { ctl } = await open(page, "request_changes");
  ctl.transition = () => errorReply("STALE_PIN");
  const d = dlg(page, "request_changes");
  await d.getByLabel("Other").check();
  await d.getByLabel("Note").fill("x");
  await d.getByRole("button", { name: "Send back" }).click();
  await expect(d).toBeHidden();
  await expect(page.getByText("This lesson changed since you opened it. Reload.")).toBeVisible();
});

test("errors: a changed snapshot is caught before sending", async ({ page }) => {
  const { ctl } = await open(page, "request_changes");
  ctl.lesson = lesson5Changed();
  const d = dlg(page, "request_changes");
  await d.getByLabel("Other").check();
  await d.getByLabel("Note").fill("x");
  await d.getByRole("button", { name: "Send back" }).click();
  await expect(d).toBeHidden();
  await expect(page.getByText("This lesson changed since you opened it. Reload.")).toBeVisible();
  expect(ctl.posted).toHaveLength(0);
});

test("errors: network keeps the text and says Try again", async ({ page }) => {
  await open(page, "request_changes");
  await page.route(apiGlob("/lessons/*/transitions"), (r) => (r.request().method() === "POST" ? r.abort() : r.fallback()));
  const d = dlg(page, "request_changes");
  await d.getByLabel("Other").check();
  await d.getByLabel("Note").fill("kept text");
  await d.getByRole("button", { name: "Send back" }).click();
  await expect(d.getByText("Couldn't reach Lesson Studio. Try again.")).toBeVisible();
  await expect(d.getByLabel("Note")).toHaveValue("kept text");
  await expect(d).toBeVisible();
});

test("errors: COLLAB_UNAVAILABLE keeps the text", async ({ page }) => {
  const { ctl } = await open(page, "request_changes");
  ctl.transition = () => errorReply("COLLAB_UNAVAILABLE");
  const d = dlg(page, "request_changes");
  await d.getByLabel("Other").check();
  await d.getByLabel("Note").fill("kept text");
  await d.getByRole("button", { name: "Send back" }).click();
  await expect(d.getByText("The collaboration service isn't reachable right now. Try again.")).toBeVisible();
  await expect(d.getByLabel("Note")).toHaveValue("kept text");
});

test("errors: INVALID_TRANSITION closes and reloads", async ({ page }) => {
  const { ctl, gets } = await open(page, "request_changes");
  ctl.transition = () => errorReply("INVALID_TRANSITION");
  const d = dlg(page, "request_changes");
  await d.getByLabel("Other").check();
  await d.getByLabel("Note").fill("x");
  await d.getByRole("button", { name: "Send back" }).click();
  await expect(d).toBeHidden();
  await expect(page.getByText("This lesson has already moved on. Showing its current state.")).toBeVisible();
  await expect.poll(() => gets.length).toBeGreaterThanOrEqual(4);
});

test("roles: author and reviewer never get the openers", async ({ page }) => {
  for (const role of ["author", "reviewer"] as const) {
    await open(page, "request_changes", { role, openIt: false });
    await expect(page.getByTestId("lesson-state")).toBeVisible();
    await expect(page.getByRole("button", { name: "Request changes…" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reopen…" })).toHaveCount(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("roles: a forced ROLE_FORBIDDEN shows the server sentence in a danger banner", async ({ page }) => {
  const { ctl } = await open(page, "request_changes");
  ctl.transition = () => ({ status: 403, json: { error: { code: "ROLE_FORBIDDEN", message: "Only approvers can request changes.", details: {} } } });
  const d = dlg(page, "request_changes");
  await d.getByLabel("Other").check();
  await d.getByLabel("Note").fill("x");
  await d.getByRole("button", { name: "Send back" }).click();
  await expect(d.getByRole("alert")).toHaveText(/Only approvers can request changes\./);
  await expect(d).toBeVisible();
  await expect(page.getByTestId("lesson-state")).toHaveText("submitted");
});

test("focus: request changes starts on the tag group", async ({ page }) => {
  await open(page, "request_changes");
  const d = dlg(page, "request_changes");
  await expect(d.getByRole("radio").first()).toBeFocused();
  await expect(d.locator("legend")).toContainText("Reason");
  await expect(d.locator("fieldset")).toHaveCount(1);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await d.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
});

test("focus: reopen starts on Reason", async ({ page }) => {
  await open(page, "reopen");
  await expect(dlg(page, "reopen").getByLabel("Reason")).toBeFocused();
});

test("focus: Escape cancels with no request", async ({ page }) => {
  const { ctl } = await open(page, "request_changes");
  await page.keyboard.press("Escape");
  await expect(dlg(page, "request_changes")).toBeHidden();
  expect(ctl.posted).toHaveLength(0);
  await expect(page.getByRole("button", { name: "Request changes…" })).toBeFocused();
});

const STATES = ["request-changes", "note-required", "reopen", "reason-required", "network", "role-forbidden"] as const;
const VIEWPORTS = [{ w: 1280, h: 900 }, { w: 390, h: 844 }];
for (const state of STATES) {
  for (const { w, h } of VIEWPORTS) {
    for (const theme of ["light", "dark"]) {
      test(`states: send-back ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        const mode: Mode = state === "reopen" || state === "reason-required" ? "reopen" : "request_changes";
        const { ctl } = await open(page, mode, { theme });
        const d = dlg(page, mode);
        if (state === "note-required") {
          await d.getByRole("button", { name: "Send back" }).click();
          await expect(d.getByText("Choose a reason.")).toBeVisible();
        } else if (state === "reason-required") {
          await d.getByRole("button", { name: "Reopen" }).click();
          await expect(d.getByText("Add a reason: say why this lesson is being reopened.")).toBeVisible();
        } else if (state === "network" || state === "role-forbidden") {
          if (state === "network") await page.route(apiGlob("/lessons/*/transitions"), (r) => (r.request().method() === "POST" ? r.abort() : r.fallback()));
          else ctl.transition = () => ({ status: 403, json: { error: { code: "ROLE_FORBIDDEN", message: "Only approvers can request changes.", details: {} } } });
          await d.getByLabel("Other").check();
          await d.getByLabel("Note").fill("Needs a closer look");
          await d.getByRole("button", { name: "Send back" }).click();
          await expect(d.getByRole("alert")).toBeVisible();
        }
        await page.evaluate(() => document.fonts.ready);
        const results = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        console.log(`axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`);
        await page.screenshot({ path: path.join(SHOTS, `send-back-${state}-${w}-${theme}.png`), fullPage: true });
        expect(bad).toEqual([]);
      });
    }
  }
}
