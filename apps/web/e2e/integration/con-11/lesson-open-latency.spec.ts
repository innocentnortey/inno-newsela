// NL-100 AC-1 (WF-8, M-18): the open is logged with lesson_id, request_id, version_id and a duration; the page marks "lesson-open".
import { expect, test } from "@playwright/test";
import { getStack } from "../support/real-stack";
import { signInAs } from "../support/users";
import { p95, scr9, timedOpens } from "./helpers";
import { seed } from "./seed";

test("test_lesson_open_logs_latency: log line fields, page timing mark, 20 single-user opens", async ({
  page,
}) => {
  const s = await seed();
  await signInAs(page, "reviewer");
  await page.goto(scr9(s.lessons.inreview));
  await expect(
    page.getByRole("heading", { level: 1, name: /The Lightning Thief/ }),
  ).toBeVisible({ timeout: 30_000 });

  await expect
    .poll(
      () =>
        page.evaluate(() => performance.getEntriesByName("lesson-open").length),
      { timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(1);
  const mark = await page.evaluate(() => {
    const m = performance.getEntriesByName("lesson-open")[0]!;
    return { startTime: m.startTime, detail: (m as PerformanceMark).detail };
  });
  expect(mark.startTime).toBeGreaterThan(0);
  expect(mark.detail).toEqual({ lesson_id: s.lessons.inreview });

  let line: Record<string, unknown> | undefined;
  await expect
    .poll(() => {
      const hit = getStack()
        .logs()
        .filter(
          (l) =>
            l.includes('"event":"lesson.open"') &&
            l.includes(`"lesson_id":"${s.lessons.inreview}"`),
        )
        .at(-1);
      line = hit ? (JSON.parse(hit) as Record<string, unknown>) : undefined;
      return line !== undefined;
    })
    .toBe(true);
  expect(line!["lesson_id"]).toBe(s.lessons.inreview);
  expect(line!["request_id"]).toMatch(/^req_/);
  expect(typeof line!["duration_ms"]).toBe("number");
  expect(line!["duration_ms"] as number).toBeGreaterThanOrEqual(0);
  const extra = line!["extra"] as { version_id: string };
  expect(extra.version_id).toBe(s.versions["inreview"]![0]!.id); // current version = generated v1

  const times = await timedOpens(page, s.lessons.inreview, 20);
  console.log("lesson-open p95 (20 single-user) ms:", p95(times));
  expect(times).toHaveLength(20);
});
