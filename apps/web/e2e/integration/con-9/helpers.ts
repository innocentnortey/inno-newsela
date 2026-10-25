// NL-98 helpers: board URLs, JSON reads through the signed-in session, a JSON walker and the screen strings (read from src/features/board).
import { expect, type Page } from "@playwright/test";
import { signInAs, type TestUser } from "../support/users";

export const BOARD_URL = (key = "g6-u4", state?: string): string => `/units/${key}/board${state ? `?state=${state}` : ""}`;

export async function getJson(page: Page, path: string): Promise<{ status: number; body: any; headers: Record<string, string> }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = await page.request.get(path);
  const text = await r.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status(), body, headers: r.headers() };
}

/** Visit every object in a JSON value. */
export function walk(json: unknown, visit: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(json)) { for (const x of json) walk(x, visit); return; }
  if (json && typeof json === "object") {
    visit(json as Record<string, unknown>);
    for (const v of Object.values(json)) walk(v, visit);
  }
}

/** Titles of the visible table rows, in DOM order. */
export const boardRows = (page: Page): Promise<string[]> => page.locator("tbody tr td:first-child a").allInnerTexts();

export const COPY = {
  empty: "No approved lessons yet",
  caption: "No baseline yet (AQ-14). Measured with us as reviewers.",
  tileError: "Couldn't load the north-star numbers.",
  waitsExcerpt: (n: number) => `Waits on Lesson ${n}'s excerpt`,
  waitsApproval: (n: number) => `Waits on Lesson ${n}'s approval`,
  reopened: "A lesson this depends on was reopened",
  failed: "Generation failed",
  noLessons: "No lessons generated for this unit yet.",
  filterGroup: "Filter lessons by state",
};

export const p95 = (ms: number[]): number => {
  const s = [...ms].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(0.95 * s.length) - 1)] ?? 0;
};

export async function openBoard(page: Page, user: TestUser, key = "g6-u4", state?: string): Promise<void> {
  if (!page.url().includes("/units") ) await signInAs(page, user);
  await page.goto(BOARD_URL(key, state));
  await expect(page.getByRole("heading", { name: /Where the \d+ lessons are/ }).or(page.getByText(COPY.noLessons)).or(page.getByText(/Couldn't load the unit board|can.t load/i)).first()).toBeVisible();
}

const CELL_ORDER = ["draft", "in_review", "submitted", "approved", "generation_failed"] as const;
/** The five roll-up cells on screen, as numbers keyed by state. */
export async function rollupCells(page: Page): Promise<Record<string, number>> {
  const texts = await page.locator("button[aria-pressed]").allInnerTexts();
  const out: Record<string, number> = {};
  CELL_ORDER.forEach((s, i) => { out[s] = Number(/(\d+)\s*$/.exec(texts[i] ?? "")?.[1]); });
  return out;
}
