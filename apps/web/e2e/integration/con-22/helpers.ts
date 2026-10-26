// NL-117 helpers: the coverage API through the signed-in page and the matrix read back from the DOM.
import { expect, type Page } from "@playwright/test";
import { signInAs, type Role, type TestUser } from "../support/users";

export interface Matrix {
  standards: { code: string; official_text: string; never_assessed: boolean }[];
  lessons: { lesson_id: string; number: number | null }[];
  cells: { code: string; lesson_id: string; roles: string[]; confirmed_by: string; source: string }[];
}

export const COVERAGE_API = (unit_id: string): string => `/api/units/${unit_id}/coverage`;
export const coverageUrl = (unit_key: string): string => `/units/${unit_key}/coverage`;
export const as = (page: Page, role: Role | TestUser): Promise<TestUser> => signInAs(page, role);

export async function getMatrix(page: Page, unit_id: string): Promise<Matrix> {
  const res = await page.request.get(COVERAGE_API(unit_id));
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as Matrix;
}

/** sorted[max(0, ceil(0.95 n) - 1)] */
export const p95 = (ms: number[]): number => {
  const s = [...ms].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(0.95 * s.length) - 1)]!;
};

/** What the screen shows: per standard row, the visible letters and mark of each lesson column ("" for an empty cell). */
export async function screenCells(page: Page): Promise<{ code: string; lesson: number; letters: string; mark: string }[]> {
  return page.evaluate(() => {
    const heads = [...document.querySelectorAll("main table thead th")].slice(1).map((th) => Number(/Lesson (\d+)/.exec(th.textContent ?? "")?.[1]));
    const out: { code: string; lesson: number; letters: string; mark: string }[] = [];
    for (const tr of document.querySelectorAll("main table tbody tr[data-code]")) {
      const code = tr.getAttribute("data-code")!;
      [...tr.querySelectorAll("td")].forEach((td, i) => {
        const hidden = [...td.querySelectorAll("[aria-hidden=true]")].map((e) => (e.textContent ?? "").trim());
        // the screen joins the letters with a thin space (U+2009); fold any whitespace run to one plain space
        const letters = hidden[0] === "–" ? "" : (hidden[0] ?? "").replace(/\s+/g, " ");
        out.push({ code, lesson: heads[i]!, letters, mark: letters ? (hidden[1] ?? "") : "" });
      });
    }
    return out;
  });
}
