// NL-96 AC-2 (WF-5): reads change nothing; poll p95 under 300 ms.
import { expect, test } from "@playwright/test";
import { startRun, snapshot, waitRun, settleAll } from "./helpers";
import { startWorker } from "./worker-harness";

test.afterEach(async ({ page }) => settleAll(page));

test("reads-change-nothing: five polls of progress and plan leave every table untouched; p95 under 300 ms", async ({ page }) => {
  test.setTimeout(180_000);
  const run = await startRun(page);
  await startWorker({ script: "script-a" });
  await waitRun(run.run_id, ["partial", "complete"]);
  await page.waitForTimeout(1500); // let the check lane and finalizer settle
  const tables = ["audit_event", "lesson_version", "lesson_job", "run"];
  const before = await snapshot(tables);
  for (let i = 0; i < 5; i++) {
    expect((await page.request.get(`/api/runs/${run.run_id}/progress`)).status()).toBe(200);
    expect((await page.request.get(`/api/runs/${run.run_id}/plan`)).status()).toBe(200);
  }
  expect(await snapshot(tables)).toEqual(before);

  const ms: number[] = [];
  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    const res = await page.request.get(`/api/runs/${run.run_id}/progress`);
    ms.push(performance.now() - t0);
    expect(res.status()).toBe(200);
  }
  ms.sort((a, b) => a - b);
  const p95 = ms[Math.ceil(0.95 * ms.length) - 1]!;
  console.log(`AC-2 poll latency over 50 reads of a 3-tile run: p50=${ms[24]!.toFixed(0)} ms p95=${p95.toFixed(0)} ms max=${ms[49]!.toFixed(0)} ms; snapshots equal: ${JSON.stringify(before)}`);
  expect(p95).toBeLessThan(300);
  expect(await snapshot(tables)).toEqual(before);
});
