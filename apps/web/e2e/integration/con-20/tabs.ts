// NL-99 tab helpers: open a lesson page in a fresh tab (own sessionStorage, so its own tab id) and drive input.
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { getStack } from "../support/real-stack";
import { signInAs, type TestUser } from "../support/users";
import type { TabPlan } from "./script";

export async function userContext(browser: Browser, user: TestUser): Promise<{ ctx: BrowserContext; home: Page }> {
  const ctx = await browser.newContext({ baseURL: getStack().baseURL });
  const home = await ctx.newPage();
  await signInAs(home, user);
  return { ctx, home };
}

// The headless page reports focus and visibility as true; a script event that says otherwise is applied by
// overriding what the sender reads (document.hasFocus, document.visibilityState) before the page's scripts run.
export async function forceFocus(page: Page, state: { focused: boolean; visible: boolean }): Promise<void> {
  await page.addInitScript((s) => {
    document.hasFocus = () => s.focused;
    Object.defineProperty(document, "visibilityState", { get: () => (s.visible ? "visible" : "hidden") });
  }, state);
}

export function lessonUrl(unit_key: string, lesson_key: string, approve = false): string {
  return `/units/${unit_key}/lessons/${lesson_key}${approve ? "/approve" : ""}`;
}

export interface BeatLog {
  bodies: { tab_id: string; focused: boolean; visible: boolean; last_input_at: string; sent_at: string; version_id: string }[];
  statuses: number[];
}
export function logBeats(page: Page): BeatLog {
  const log: BeatLog = { bodies: [], statuses: [] };
  page.on("request", (r) => {
    if (r.url().includes("/heartbeats") && r.method() === "POST") log.bodies.push(JSON.parse(r.postData() ?? "{}"));
  });
  page.on("response", (r) => {
    if (r.url().includes("/heartbeats")) log.statuses.push(r.status());
  });
  return log;
}

// Drive input for `seconds` of real time: active tabs get a mouse move every 4 s, idle tabs get one at t = 0.
export async function drive(pages: { page: Page; plan: Pick<TabPlan, "mode"> }[], seconds: number): Promise<void> {
  for (const p of pages) await p.page.mouse.move(20, 20);
  const end = Date.now() + seconds * 1000;
  let i = 0;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, Math.min(4000, Math.max(0, end - Date.now()))));
    i += 1;
    for (const p of pages) if (p.plan.mode === "active") await p.page.mouse.move(20 + (i % 50), 20 + (i % 30));
  }
}
