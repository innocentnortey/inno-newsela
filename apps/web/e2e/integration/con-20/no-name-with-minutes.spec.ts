// NL-99 AC-4 (WF-16, GR-15): no response used in the review holds minutes beside a person's name.
import { expect, test, type Response } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { signInAs } from "../support/users";
import { approveViaApi, reviewFor, submittedLesson } from "./flow";
import { lessonUrl, userContext } from "./tabs";
import { DISCLOSURE_TEXT } from "./text";

// "name" alone also names sections and templates, so it only counts when its value is a real person (a staff name or email).
const PERSON_KEY = /^(display_name|user|user_name|email|reviewer|reviewer_name|by|actor|actor_name)$/i;
const MINUTES_KEY = /(^|_)(minutes|seconds)$/i;

export function walk(v: unknown, path: string, hits: string[], people: ReadonlySet<string>): void {
  if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`, hits, people));
  if (v === null || typeof v !== "object") return;
  const keys = Object.keys(v as object);
  const val = (k: string) => (v as Record<string, unknown>)[k];
  const named = keys.filter((k) => typeof val(k) === "string" && val(k) !== "" && (PERSON_KEY.test(k) || people.has(val(k) as string)));
  const timed = keys.filter((k) => MINUTES_KEY.test(k) && (v as Record<string, unknown>)[k] !== null);
  if (named.length > 0 && timed.length > 0) hits.push(`${path}: ${named.join(",")} + ${timed.join(",")}`);
  for (const k of keys) walk(val(k), `${path}.${k}`, hits, people);
}

test("no-name-with-minutes: every JSON body of the review is walked, 0 objects pair a name with minutes", async ({ browser }) => {
  test.setTimeout(150_000);
  const s = await submittedLesson();
  const seen: { url: string; text: string }[] = [];
  const keep = async (r: Response) => {
    const u = r.url();
    if (!/\/api\/(lessons|units)\//.test(u)) return;
    const t = await r.text().catch(() => "");
    seen.push({ url: u, text: t });
  };
  const rev = await userContext(browser, s.reviewer);
  const rp = await rev.ctx.newPage();
  rp.on("response", keep);
  await rp.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key));
  await expect(rp.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
  await rev.ctx.close();
  await reviewFor(browser, s, 35);

  const ap = await userContext(browser, s.approver);
  const page = await ap.ctx.newPage();
  page.on("response", keep);
  const res = await approveViaApi(page, s);
  expect(res.status(), await res.text()).toBe(200);
  await page.goto(`/units/${s.unit.unit_key}/board`);
  await page.waitForTimeout(1500);
  for (const path of [`/api/units/${s.unit.unit_id}/metrics`, `/api/units/${s.unit.unit_id}/board`, `/api/lessons/${s.lesson.lesson_id}`]) {
    const r = await page.request.get(path);
    seen.push({ url: path, text: await r.text() });
  }
  const routes = new Set(seen.map((x) => new URL(x.url, getStack().baseURL).pathname.replace(/\/[A-Z0-9.]+(\/|$)/g, "/:id$1")));
  console.log(`walked ${seen.length} responses over ${routes.size} routes: ${[...routes].join(" ")}`);
  expect(seen.some((x) => x.url.includes("/metrics"))).toBe(true);
  expect(seen.some((x) => x.url.includes("/board"))).toBe(true);
  const staff = await db().query<{ name: string; email: string }>("select name, email from app_user");
  const people = new Set(staff.flatMap((u) => [u.name, u.email]));
  const hits: string[] = [];
  for (const x of seen) {
    if (!x.text.startsWith("{") && !x.text.startsWith("[")) continue;
    walk(JSON.parse(x.text), x.url, hits, people);
  }
  expect(hits, "objects holding a name and a minutes value").toEqual([]);
  const metricsText = seen.filter((x) => x.url.includes("/metrics")).map((x) => x.text).join("\n");
  expect(metricsText).not.toContain(s.reviewer.name);
  expect(metricsText).not.toContain(s.reviewer.email);
  void signInAs;
  await ap.ctx.close();
});
