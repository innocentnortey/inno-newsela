// NL-104 helpers: URLs, JSON reads through the signed-in session, a JSON walker, the screen strings and tile text lookup.
import type { Page } from "@playwright/test";

export const QUALITY_URL = (key: string): string => `/units/${key}/quality`;
export const METRICS_PATH = (id: string): string => `/api/units/${id}/metrics`;

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

// Screen strings; src/features/quality/copy.ts wins when it differs.
export const COPY = {
  title: "Unit quality",
  groups: ["Draft quality (V)", "Operations and cost (O)", "Health (H)"],
  empty: "No approved lessons yet",
  ratings: "Draft-quality ratings",
  seeded: "Seeded-error report",
  label: "our reviewers",
  context: "Reviewer time context",
  cantLoad: "Couldn't load unit quality",
  notFound: "There is no page in",
};

export const p95 = (ms: number[]): number => {
  const s = [...ms].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(0.95 * s.length) - 1)] ?? 0;
};

/** The tile's list item, found by its label (tiles carry no id in the DOM). */
export const tileText = (page: Page, label: string): Promise<string> => page.locator("main li", { hasText: label }).first().innerText();

import { expect } from "@playwright/test";
import { signInAs, type TestUser } from "../support/users";

/** Sign in when not yet signed in, open SCR-19 and wait for a settled state (title, empty line, error or not-found). */
export async function openQuality(page: Page, user: TestUser, key: string): Promise<void> {
  if (page.url() === "about:blank" || page.url().includes("/sign-in")) await signInAs(page, user);
  await page.goto(QUALITY_URL(key));
  await expect(
    page.getByRole("heading", { name: COPY.title }).or(page.getByText(COPY.cantLoad)).or(page.getByText(COPY.notFound)).first(),
  ).toBeVisible();
}
