// NL-115 AC-16: SCR-15 is reachable from SCR-14's DecisionCard and works on the real stack (CHG-3 pin in the body).
import { expect, test, type Browser, type Page } from "@playwright/test";
import { bridgeCollab } from "../con-12/bridge";
import { snapshot } from "./counts";
import { apiAs, approveBody, lessonPath, reviewerEdits, signedInPage, transition } from "./flow";
import { SOURCE, cast, seedFlex, type Cast, type SeededLesson } from "./seed";
import { startCon18Stack, type Con18Stack } from "./stack";

let stack: Con18Stack;
test.beforeAll(async () => {
  test.setTimeout(240_000);
  stack = await startCon18Stack();
});
test.afterAll(async () => {
  await stack?.stop();
});

const submitted = (c: Cast): Promise<SeededLesson> =>
  seedFlex({ unit: c.unit, number: SOURCE, state: "submitted", reviewer_id: c.reviewer.user_id, last_editor_id: c.reviewer.user_id });

async function open(browser: Browser, user: Cast["reviewer"], path: string, withCollab = false) {
  const context = await browser.newContext();
  const page = await signedInPage(context, user, stack);
  if (withCollab) await bridgeCollab(page, stack.collabPort);
  await page.goto(`${stack.baseURL}${path}`);
  return { context, page };
}

/** The JSON body of every transitions POST the page sends. */
function captureBodies(page: Page): Record<string, unknown>[] {
  const bodies: Record<string, unknown>[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/transitions")) bodies.push(JSON.parse(r.postData() ?? "{}") as Record<string, unknown>);
  });
  return bodies;
}

test("send-back: Request changes on SCR-14 sends tag, note and the snapshot pin; the reviewer sees changes_requested on SCR-9 [invariant]", async ({ browser }) => {
  const c = await cast();
  const lesson = await submitted(c);
  const a = await open(browser, c.approver, lessonPath(lesson, true));
  const r = await open(browser, c.reviewer, lessonPath(lesson), true);
  try {
    await expect(a.page.getByRole("heading", { name: "Checklist" })).toBeVisible({ timeout: 30_000 });
    const bodies = captureBodies(a.page);
    await a.page.getByRole("button", { name: "Request changes" }).click();
    const dialog = a.page.getByRole("dialog", { name: /Request changes to Lesson 99/ });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Standards").check();
    await dialog.getByLabel("Note").fill("Check the standards codes in Look Back.");
    const reply = a.page.waitForResponse((x) => x.url().includes("/transitions") && x.request().method() === "POST");
    await dialog.getByRole("button", { name: "Send back" }).click();
    expect((await reply).status()).toBe(200);

    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual({
      action: "request_changes", tag: "standards", note: "Check the standards codes in Look Back.",
      snapshot_hash: lesson.snapshot!.content_hash, snapshot_state_vector: lesson.snapshot!.state_vector,
    });
    console.log(`send-back request body: ${JSON.stringify(bodies[0]).replace(/"(snapshot_hash)":"([0-9a-f]{8})[0-9a-f]+"/, '"$1":"$2…"')}`);
    expect((await snapshot(lesson.lesson_id)).state).toBe("changes_requested");

    await r.page.reload();
    await expect(r.page.getByTestId("state-banner")).toContainText("Changes requested", { timeout: 30_000 });
    await expect(r.page.getByTestId("state-banner")).toContainText(`Changes requested by ${c.approver.name}`);
    // Seam S-115-1 (lesson-read-service, not this ticket): SCR-9 shows the tag as "Other" and the note empty because the read
    // model hard-codes the tag and reads review_event.reason instead of reason_tag / note. Recorded, not asserted.
    test.info().annotations.push({ type: "S-115-1 banner text", description: (await r.page.getByTestId("state-banner").innerText()).replace(/\s+/g, " ") });
  } finally {
    await a.context.close();
    await r.context.close();
  }
});

test("send-back: Reopen on an approved lesson sends the reason and pin; the reviewer sees reopened on SCR-9 [invariant]", async ({ browser }) => {
  const c = await cast();
  const lesson = await submitted(c);
  const A = await apiAs(stack, c.approver);
  expect((await transition(A, lesson.lesson_id, approveBody({ snapshot_hash: lesson.snapshot!.content_hash, snapshot_state_vector: lesson.snapshot!.state_vector }))).status).toBe(200);
  const a = await open(browser, c.approver, lessonPath(lesson, true));
  const r = await open(browser, c.reviewer, lessonPath(lesson), true);
  try {
    const reopen = a.page.getByRole("button", { name: "Reopen…" });
    await expect(reopen).toBeVisible({ timeout: 30_000 });
    const bodies = captureBodies(a.page);
    await reopen.click();
    const dialog = a.page.getByRole("dialog", { name: /Reopen Lesson 99/ });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Reason").fill("A rights question came up after approval.");
    const reply = a.page.waitForResponse((x) => x.url().includes("/transitions") && x.request().method() === "POST");
    await dialog.getByRole("button", { name: "Reopen" }).click();
    expect((await reply).status()).toBe(200);
    const [body] = bodies;
    expect(body).toMatchObject({ action: "reopen", reason: "A rights question came up after approval." });
    expect(body).toHaveProperty("snapshot_hash");
    expect(body).toHaveProperty("snapshot_state_vector");
    expect((await snapshot(lesson.lesson_id)).state).toBe("reopened");
    await r.page.reload();
    await expect(r.page.getByTestId("state-banner")).toContainText("Reopened", { timeout: 30_000 });
  } finally {
    await a.context.close();
    await r.context.close();
  }
});

test("send-back: a stale pin shows the SCR-14 stale banner through onStale, not the form's own toast [negative]", async ({ browser }) => {
  const c = await cast();
  const lesson = await submitted(c);
  const R = await apiAs(stack, c.reviewer);
  const rCtx = await browser.newContext();
  await signedInPage(rCtx, c.reviewer, stack);
  const a = await open(browser, c.approver, lessonPath(lesson, true));
  try {
    await expect(a.page.getByRole("heading", { name: "Checklist" })).toBeVisible({ timeout: 30_000 });
    await a.page.getByRole("button", { name: "Request changes" }).click();
    const dialog = a.page.getByRole("dialog", { name: /Request changes to Lesson 99/ });
    await dialog.getByLabel("Teaching quality").check();
    await dialog.getByLabel("Note").fill("Tighten the opening.");

    // While the dialog is open the reviewer withdraws, edits and sends the lesson in again: a new snapshot.
    expect((await transition(R, lesson.lesson_id, { action: "withdraw" })).status).toBe(200);
    const vector = await reviewerEdits(stack, rCtx, lesson.lesson_id, `Changed under the open dialog ${Date.now()}`);
    expect((await transition(R, lesson.lesson_id, { action: "submit", client_state_vector: vector })).status).toBe(200);
    const before = await snapshot(lesson.lesson_id);

    await dialog.getByRole("button", { name: "Send back" }).click();
    await expect(a.page.getByText("This lesson changed since you opened it. Reload.")).toHaveCount(1, { timeout: 15_000 }); // the banner, once; the form's toast would make it two
    await expect(a.page.getByRole("button", { name: "Reload" })).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(await snapshot(lesson.lesson_id)).toEqual(before); // refused before any write
  } finally {
    await a.context.close();
    await rCtx.close();
  }
});
