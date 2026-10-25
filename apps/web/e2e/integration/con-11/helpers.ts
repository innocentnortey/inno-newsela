// NL-100 helpers for the con-11 specs (kept here: support/** is NL-90's). Reads of the API are through the signed-in page's request context.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import type { components } from "../../../../../docs/contracts/generated/api-types";

export type Lesson = components["schemas"]["Lesson"];
export type LessonHistory = components["schemas"]["LessonHistory"];

export const REPO_ROOT = resolve(__dirname, "../../../../..");
export const scr9 = (id: string): string =>
  `/units/g6-u4/lessons/${id.slice(id.lastIndexOf(".") + 1)}`;
export const scr16 = (id: string): string => `${scr9(id)}/history`;

export async function getLesson(
  page: Page,
  ref: string,
): Promise<{
  status: number;
  body: Lesson & { error?: { code: string; details: Record<string, unknown> } };
}> {
  const r = await page.request.get(`/api/lessons/${encodeURIComponent(ref)}`);
  return { status: r.status(), body: await r.json() };
}
export async function getHistory(
  page: Page,
  ref: string,
): Promise<{
  status: number;
  body: LessonHistory & { error?: { code: string } };
}> {
  const r = await page.request.get(
    `/api/lessons/${encodeURIComponent(ref)}/history`,
  );
  return { status: r.status(), body: await r.json() };
}

/** Every address WP-1's "Required output" table in docs/data/worked-pairs.md names, read from the file (not retyped). */
export function wp1RequiredAddresses(): string[] {
  const md = readFileSync(
    resolve(REPO_ROOT, "docs/data/worked-pairs.md"),
    "utf8",
  );
  const start = md.indexOf("## WP-1");
  const end = md.indexOf('<a id="wp-2"', start);
  const block = md.slice(start, end === -1 ? undefined : end);
  const out: string[] = [];
  for (const line of block.split("\n")) {
    const m = /^\| [A-Za-z ]+ `([^`]+)` \| \d+ \|/.exec(line);
    if (m)
      out.push(m[1]!.startsWith("…") ? `G6.U4.L4.${m[1]!.slice(1)}` : m[1]!);
  }
  return out;
}

export async function waitForLesson(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 30_000,
  });
}

/** Walk any JSON value; call f on every object. */
export function walk(
  v: unknown,
  f: (o: Record<string, unknown>, path: string) => void,
  path = "$",
): void {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, f, `${path}[${i}]`));
  else if (v !== null && typeof v === "object") {
    f(v as Record<string, unknown>, path);
    for (const [k, x] of Object.entries(v)) walk(x, f, `${path}.${k}`);
  }
}

export function p95(ms: number[]): number {
  const s = [...ms].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]!;
}

/** 20 sequential single-user opens of one lesson through the API; returns the wall-clock ms of each. */
export async function timedOpens(
  page: Page,
  lessonId: string,
  n = 20,
): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = Date.now();
    const r = await page.request.get(`/api/lessons/${lessonId}`);
    expect(r.status()).toBe(200);
    await r.body();
    out.push(Date.now() - t0);
  }
  return out;
}

export async function readCounts(): Promise<Record<string, number | string>> {
  const { db } = await import("../support/db");
  const d = db();
  return {
    lesson_states: (
      await d.query<{ s: string }>(
        "select string_agg(id || ':' || state || ':' || coalesce(reviewer_id,'-') || ':' || coalesce(current_version_id,'-'), ',' order by id) as s from lesson",
      )
    )[0]!.s,
    review_event: await d.count("review_event"),
    audit_event: await d.count("audit_event"),
    lesson_version: await d.count("lesson_version"),
  };
}
