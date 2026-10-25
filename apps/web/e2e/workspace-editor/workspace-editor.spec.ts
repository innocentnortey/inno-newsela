import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { COLLAB_COOKIE } from "../../src/test-utils/fixtures";

const MOCK = "http://127.0.0.1:4020";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SHOTS = "e2e/__screenshots__/workspace-editor";
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const axe = (page: Page) => new AxeBuilder({ page: page as unknown as AxePage });

const unique = (name: string) => `G6.U4.T-${name}-${Date.now()}`;
const PART_B = "Lesson 4 text · Part B";
const PART_A = "Lesson 4 text · Part A";

async function open(browser: Browser, doc: string, q: Record<string, string> = {}, ctx?: BrowserContext) {
  const context = ctx ?? (await browser.newContext());
  await context.addCookies([{ ...COLLAB_COOKIE, domain: "localhost", path: "/" }]);
  const page = await context.newPage();
  const qs = new URLSearchParams({ doc, ...q }).toString();
  await page.goto(`/harness/editor?${qs}`);
  return page;
}
const state = (page: Page) => page.getByTestId("lesson-editor");
async function synced(page: Page) {
  await expect(page.getByRole("textbox", { name: PART_B })).toBeVisible({ timeout: 15_000 });
  await expect(state(page)).toHaveAttribute("data-client-state", /^(synced|stored|saving)$/);
}
const post = (path: string) => fetch(`${MOCK}${path}`, { method: "POST" });

test("collab: two sessions see text, caret flag, presence sentence and the stored ack", async ({ browser }) => {
  const doc = unique("collab");
  const a = await open(browser, doc, { as: "okafor", seed: "1" });
  await synced(a);
  const b = await open(browser, doc, { as: "rivera" });
  await synced(b);

  const box_a = a.getByRole("textbox", { name: PART_B });
  await box_a.click();
  const typed_at = Date.now();
  await a.keyboard.type("Hello");
  await expect.poll(async () => (await b.getByRole("textbox", { name: PART_B }).textContent()) ?? "", { timeout: 1000 }).toContain("Hello");
  await expect(b.locator(".ls-caret-flag", { hasText: "M. Okafor" }).first()).toBeVisible();
  await expect(b.getByTestId("presence-sentence")).toHaveText("M. Okafor is editing Part B");

  const slot = a.getByTestId("save-state");
  await expect(slot).toHaveText("Saving…", { timeout: 1500 });
  await expect(slot).toHaveText(/^Saved · \d{2}:\d{2}$/, { timeout: 3000 });
  const stored_at = (await slot.getAttribute("data-stored-at")) ?? "";
  expect(Date.parse(stored_at) - typed_at).toBeLessThanOrEqual(2000);
  await a.context().close();
  await b.context().close();
});

test("reconnect: dropped socket shows the banner, keeps typing, resends held edits", async ({ browser }) => {
  const doc = unique("reconnect");
  const a = await open(browser, doc, { as: "okafor", seed: "1" });
  await synced(a);
  const b = await open(browser, doc, { as: "rivera" });
  await synced(b);

  await post("/__mock/drop");
  await expect(a.getByText("Reconnecting: your last edits are not saved yet. Submit is off until they are.")).toBeVisible({ timeout: 10_000 });
  await expect(a.getByTestId("save-state")).toHaveText("Not saved");
  const box_a = a.getByRole("textbox", { name: PART_A });
  await box_a.click();
  await a.keyboard.type("offline");
  await expect(b.getByRole("textbox", { name: PART_A })).toContainText("offline", { timeout: 20_000 });
  await expect(a.getByTestId("client-report")).toHaveText("stored", { timeout: 20_000 });
  expect(await a.evaluate(() => window.__editor_reports?.at(-1)?.state)).toBe("stored");
  await a.context().close();
  await b.context().close();
});

async function refused_pair(browser: Browser, doc: string) {
  const a = await open(browser, doc, { as: "okafor", seed: "1", hold_mode: "1" });
  await synced(a);
  const b = await open(browser, doc, { as: "rivera" });
  await synced(b);
  await post(`/__mock/lock?doc=${encodeURIComponent(`lesson:${doc}`)}`);
  const box = a.getByRole("textbox", { name: PART_A });
  await box.click();
  await a.keyboard.type("late");
  return { a, b };
}

test("refused: a keystroke after the lock is dropped and told to the typist", async ({ browser }) => {
  const doc = unique("refused");
  const { a, b } = await refused_pair(browser, doc);
  const alert = a.getByTestId("lesson-editor").getByRole("alert");
  await expect(alert).toContainText("Your last edits were not saved because Lesson 4");
  await expect(alert).toContainText("They have been removed from your view.");
  await expect(a.getByRole("textbox", { name: PART_A })).not.toContainText("late");
  await expect(a.getByRole("textbox", { name: PART_A })).not.toHaveAttribute("contenteditable", "true");
  await expect(b.getByRole("textbox", { name: PART_A })).not.toContainText("late");
  await b.waitForTimeout(3000);
  await expect(b.getByRole("textbox", { name: PART_A })).not.toContainText("late");
  await b.reload();
  await expect(b.getByRole("textbox", { name: PART_A })).toBeVisible();
  await expect(b.getByRole("textbox", { name: PART_A })).not.toContainText("late");
  await a.context().close();
  await b.context().close();
});

test("unauth: a socket without the session cookie shows the signed-out notice", async ({ browser }) => {
  const doc = unique("unauth");
  const a = await open(browser, doc, { seed: "1" });
  await synced(a);
  await a.context().clearCookies();
  await post("/__mock/drop");
  await expect(a.getByTestId("lesson-editor").getByRole("alert")).toContainText("Your session has ended. Sign in again to keep editing.", { timeout: 15_000 });
  await expect(a.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(a.getByRole("textbox")).toHaveCount(0);
  await a.context().close();
});

test("readonly: prop, mode message and non-reviewer role remove the toolbar and caret", async ({ browser }) => {
  const toolbar = (p: Page) => p.getByRole("toolbar", { name: "Formatting" });
  const check = async (p: Page) => {
    await expect(p.getByRole("textbox", { name: PART_B })).toBeVisible({ timeout: 15_000 });
    await expect(toolbar(p)).toHaveCount(0);
    await expect(p.getByRole("textbox", { name: PART_B })).not.toHaveAttribute("contenteditable", "true");
  };
  const ro = await open(browser, unique("ro"), { seed: "1", ro: "1" });
  await check(ro);
  const approver = await open(browser, unique("role"), { seed: "1", role: "approver" });
  await check(approver);
  const doc = unique("mode");
  const rev = await open(browser, doc, { seed: "1" });
  await synced(rev);
  await expect(toolbar(rev)).toHaveCount(1);
  await post(`/__mock/lock?doc=${encodeURIComponent(`lesson:${doc}`)}`);
  await check(rev);

  // Keyboard order: toolbar, then the first textbox, then the rail.
  const edit = await open(browser, unique("kbd"), { seed: "1" });
  await synced(edit);
  const seen: string[] = [];
  await edit.locator("body").click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < 30; i++) {
    await edit.keyboard.press("Tab");
    const where = await edit.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return "none";
      if (el.closest("[role=toolbar]")) return "toolbar";
      if (el.getAttribute("role") === "textbox") return "textbox";
      if (el.closest("aside")) return "rail";
      return "other";
    });
    if (seen.at(-1) !== where) seen.push(where);
    if (where === "rail") break;
  }
  expect(seen.filter((s) => s !== "other")).toEqual(["toolbar", "textbox", "rail"]);
  for (const p of [ro, approver, rev, edit]) await p.context().close();
});

// A persistent DISCONNECTED state: the page's socket is routed through the test, which can cut it and refuse new ones.
async function cut_socket(page: Page) {
  let blocked = false;
  const open_pairs: Array<() => void> = [];
  await page.routeWebSocket(/:4020/, (ws) => {
    if (blocked) {
      void ws.close();
      return;
    }
    ws.connectToServer();
    open_pairs.push(() => void ws.close());
  });
  return () => {
    blocked = true;
    for (const c of open_pairs) c();
  };
}

test("@axe states at 1280 and 390, light and dark, with screenshots", async ({ browser }) => {
  test.setTimeout(300_000);
  const combos = [
    { w: 1280, h: 900, theme: "light" },
    { w: 1280, h: 900, theme: "dark" },
    { w: 390, h: 844, theme: "light" },
    { w: 390, h: 844, theme: "dark" },
  ] as const;
  const run = async (name: string, page: Page, shot?: string) => {
    for (const c of combos) {
      await page.setViewportSize({ width: c.w, height: c.h });
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), c.theme);
      await page.evaluate(() => document.fonts.ready);
      const res = await axe(page).withTags(TAGS).analyze();
      const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      console.log(`axe ${name} ${c.w}x ${c.theme}: ${bad.length} serious/critical`);
      if (shot) await page.screenshot({ path: `${SHOTS}/${shot}-${c.w}-${c.theme}.png`, fullPage: true });
      expect(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
    }
  };

  // editing with a co-editor present
  const doc = unique("axe");
  const a = await open(browser, doc, { as: "okafor", seed: "1" });
  await synced(a);
  const b = await open(browser, doc, { as: "rivera" });
  await synced(b);
  await b.getByRole("textbox", { name: PART_B }).click();
  await b.keyboard.type("Synthetic words");
  await expect(a.getByTestId("presence-sentence")).toHaveText("J. Rivera is editing Part B");
  await run("editing+co-editor", a, "main");

  // read-only
  const ro = await open(browser, unique("axe-ro"), { seed: "1", ro: "1" });
  await expect(ro.getByRole("textbox", { name: PART_B })).toBeVisible({ timeout: 15_000 });
  await run("read-only", ro);

  // DISCONNECTED
  const dis_ctx = await browser.newContext();
  const dis = await dis_ctx.newPage();
  await dis_ctx.addCookies([{ ...COLLAB_COOKIE, domain: "localhost", path: "/" }]);
  const cut = await cut_socket(dis);
  await dis.goto(`/harness/editor?${new URLSearchParams({ doc: unique("axe-dis"), seed: "1" })}`);
  await expect(dis.getByTestId("lesson-editor")).toHaveAttribute("data-client-state", /^(synced|stored)$/, { timeout: 15_000 });
  cut();
  await expect(dis.getByText("Reconnecting: your last edits are not saved yet.")).toBeVisible({ timeout: 10_000 });
  await run("disconnected", dis);

  // refused notice
  const { a: ra, b: rb } = await refused_pair(browser, unique("axe-ref"));
  await expect(ra.getByTestId("lesson-editor").getByRole("alert")).toContainText("Your last edits were not saved because Lesson 4");
  await run("refused", ra, "refused");

  for (const p of [a, b, ro, dis, ra, rb]) await p.context().close();
});
