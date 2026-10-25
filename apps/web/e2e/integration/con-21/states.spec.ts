// NL-97 AC-3: n on every number, p95 against the target, in-progress banner, "No failures.", shared not-found.
import { expect, test } from "@playwright/test";
import { authorSession, getSummary, runScenario, screenFigures, startRun, summaryUrl } from "./helpers";

test("states: in-progress run shows the info banner", async ({ page }) => {
  const { up } = await authorSession(page);
  const runId = await startRun(page, up, "repaired", { drain: false });
  expect((await getSummary(page, runId)).state).not.toMatch(/^(complete|failed)$/);
  await page.goto(summaryUrl(runId, up.unit_key));
  await expect(page.getByText("This run is still going. Numbers so far:")).toBeVisible();
  await expect(page.getByText(/^n = \d+ lessons?$/).first()).toBeVisible();
});

test("states: no-failures run says so, every number carries n and p95 sits against 5 min", async ({ page }) => {
  const { up, runId } = await runScenario(page, "repaired");
  const s = await getSummary(page, runId);
  expect(s.failures_by_reason).toEqual([]);
  await page.goto(summaryUrl(runId, up.unit_key));
  await expect(page.getByText("No failures.")).toBeVisible();
  await expect(page.getByText("This run is still going.")).toHaveCount(0);
  const fig = await screenFigures(page);
  for (const k of ["Wall time", "Cost per lesson", "p95 minutes per lesson", "Retries"]) expect(fig[k], k).toMatch(/n = \d+ lessons?/);
  expect(fig["p95 minutes per lesson"]).toContain("against the 5-minute target");
});

test("states: unknown run id gives the shared not-found state and NOT_FOUND on the API", async ({ page }) => {
  const { up } = await authorSession(page);
  const res = await page.request.get("/api/runs/run_nope/summary");
  expect(res.status()).toBe(404);
  expect(((await res.json()) as { error?: { code?: string } }).error?.code).toBe("NOT_FOUND");
  await page.goto(summaryUrl("run_nope", up.unit_key));
  await expect(page.getByText(/^There is no run in /)).toBeVisible();
});
