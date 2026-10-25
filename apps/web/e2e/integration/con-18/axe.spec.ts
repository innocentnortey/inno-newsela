// NL-115 AC-14: axe (WCAG 2.2 AA tags) on SCR-9 (submit path), SCR-14 and SCR-15 states reached on the real backend,
// 2 viewports x 2 themes. 0 serious and 0 critical.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { bridgeCollab } from "../con-12/bridge";
import { axeScan, matrix, setTheme } from "../support/axe";
import { apiAs, approveBody, lessonPath, reviewerEdits, signedInPage, transition } from "./flow";
import { DEPENDANT, SOURCE, cast, freshUnit, linkDependant, seedFlex, slotOf, type Cast, type SeededLesson } from "./seed";
import { startCon18Stack, type Con18Stack } from "./stack";

let stack: Con18Stack;
test.beforeAll(async () => {
  test.setTimeout(240_000);
  stack = await startCon18Stack();
});
test.afterAll(async () => {
  await stack?.stop();
});

async function check(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe ${state} ${viewport.width}x ${theme}: ${r.serious} serious, ${r.critical} critical`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
  });
}

const lone = (c: Cast, o: { state: "in_review" | "submitted"; resolved?: boolean }): Promise<SeededLesson> =>
  seedFlex({ unit: c.unit, number: SOURCE, state: o.state, reviewer_id: c.reviewer.user_id, last_editor_id: c.reviewer.user_id, ...(o.resolved === undefined ? {} : { resolved: o.resolved }) });

async function at(browser: Browser, user: Cast["reviewer"], lesson: SeededLesson, approve: boolean, collab = false) {
  const context = await browser.newContext();
  const page = await signedInPage(context, user, stack);
  if (collab) await bridgeCollab(page, stack.collabPort);
  await page.goto(`${stack.baseURL}${lessonPath(lesson, approve)}`);
  return { context, page };
}

test("axe SCR-9 submit blocked and submit ready @axe", async ({ browser }) => {
  const c = await cast();
  const blocked = await lone(c, { state: "in_review", resolved: false });
  const b = await at(browser, c.reviewer, blocked, false, true);
  try {
    await expect(b.page.getByTestId("submit-reasons")).toContainText(/blocking/i, { timeout: 30_000 });
    await expect(b.page.getByRole("button", { name: "Submit for approval" })).toHaveAttribute("aria-disabled", "true");
    await check(b.page, "SCR-9 submit blocked");
  } finally {
    await b.context.close();
  }
  const ready = await seedFlex({ unit: await freshUnit(), number: SOURCE, state: "in_review", reviewer_id: c.reviewer.user_id });
  const r = await at(browser, c.reviewer, ready, false, true);
  try {
    await expect(r.page.getByRole("button", { name: "Submit for approval" })).not.toHaveAttribute("aria-disabled", "true", { timeout: 30_000 });
    await check(r.page, "SCR-9 submit ready");
  } finally {
    await r.context.close();
  }
});

test("axe SCR-9 submitted and frozen @axe", async ({ browser }) => {
  const c = await cast();
  const lesson = await lone(c, { state: "submitted" });
  const s = await at(browser, c.reviewer, lesson, false, true);
  try {
    await expect(s.page.getByRole("button", { name: "Withdraw" })).toBeVisible({ timeout: 30_000 });
    await check(s.page, "SCR-9 submitted frozen");
  } finally {
    await s.context.close();
  }
});

test("axe SCR-14 waiting, approvable and approved @axe", async ({ browser }) => {
  const c = await cast();
  const src = await seedFlex({ unit: c.unit, number: SOURCE, state: "submitted", reviewer_id: c.reviewer.user_id, last_editor_id: c.reviewer.user_id, slot_id: slotOf(c.unit.unit_id) });
  const dep = await seedFlex({ unit: c.unit, number: DEPENDANT, state: "submitted", reviewer_id: c.reviewer.user_id, last_editor_id: c.reviewer.user_id });
  await linkDependant(c.unit.unit_id);
  const w = await at(browser, c.approver, dep, true);
  try {
    await expect(w.page.getByText(/Waiting on|can now be approved|Approve this version/).first()).toBeVisible({ timeout: 30_000 });
    await check(w.page, "SCR-14 waiting on a source");
  } finally {
    await w.context.close();
  }
  const a = await at(browser, c.approver, src, true);
  try {
    await expect(a.page.getByRole("button", { name: "Approve this version" })).toBeVisible({ timeout: 30_000 });
    await check(a.page, "SCR-14 approvable");
    await a.page.getByLabel("Usable with edits").check();
    await a.page.getByRole("button", { name: "Approve this version" }).click();
    await expect(a.page.getByText(/Approved by/).first()).toBeVisible({ timeout: 30_000 });
    await check(a.page, "SCR-14 approved");
  } finally {
    await a.context.close();
  }
});

test("axe SCR-14 stale and SCR-15 dialogs @axe", async ({ browser }) => {
  const c = await cast();
  const lesson = await lone(c, { state: "submitted" });
  const R = await apiAs(stack, c.reviewer);
  const rCtx = await browser.newContext();
  await signedInPage(rCtx, c.reviewer, stack);
  const a = await at(browser, c.approver, lesson, true);
  try {
    await expect(a.page.getByRole("button", { name: "Request changes" })).toBeVisible({ timeout: 30_000 });
    // SCR-15, request-changes dialog: open, and refused (empty note).
    await a.page.getByRole("button", { name: "Request changes" }).click();
    const dialog = a.page.getByRole("dialog", { name: /Request changes to/ });
    await expect(dialog).toBeVisible();
    await check(a.page, "SCR-15 request changes");
    await dialog.getByLabel("Standards").check();
    await dialog.getByRole("button", { name: "Send back" }).click();
    await expect(dialog.getByText("Add a note: say what needs to change.")).toBeVisible();
    await check(a.page, "SCR-15 note required");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    // SCR-14 stale: the lesson changes under the open page.
    expect((await transition(R, lesson.lesson_id, { action: "withdraw" })).status).toBe(200);
    const vector = await reviewerEdits(stack, rCtx, lesson.lesson_id, `Changed for the stale state ${Date.now()}`);
    expect((await transition(R, lesson.lesson_id, { action: "submit", client_state_vector: vector })).status).toBe(200);
    await a.page.getByLabel("Usable as drafted").check();
    await a.page.getByRole("button", { name: "Approve this version" }).click();
    await expect(a.page.getByRole("button", { name: "Reload" })).toBeVisible({ timeout: 15_000 });
    await check(a.page, "SCR-14 stale");
    await a.page.getByRole("button", { name: "Reload" }).click();
    await expect(a.page.getByRole("button", { name: "Reload" })).toBeHidden({ timeout: 15_000 });
  } finally {
    await a.context.close();
    await rCtx.close();
  }

  // SCR-15 reopen dialog on an approved lesson.
  const done = await lone({ ...c, unit: await freshUnit() }, { state: "submitted" });
  const A = await apiAs(stack, c.approver);
  expect((await transition(A, done.lesson_id, approveBody({ snapshot_hash: done.snapshot!.content_hash, snapshot_state_vector: done.snapshot!.state_vector }))).status).toBe(200);
  const o = await at(browser, c.approver, done, true);
  try {
    await o.page.getByRole("button", { name: "Reopen…" }).click();
    const dialog = o.page.getByRole("dialog", { name: /Reopen/ });
    await expect(dialog).toBeVisible();
    await check(o.page, "SCR-15 reopen");
  } finally {
    await o.context.close();
  }
});
