// NL-97 AC-1: totals on the route, in the oracle SQL and on SCR-17 agree for a run with a repair, a truncation retry, a lost call and a failed lesson.
import Decimal from "decimal.js";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { formatUsd } from "../../../src/features/run-summary/format";
import { failuresOnScreen, runScenario, screenFigures, summaryUrl } from "./helpers";
import { oracleSummary } from "./oracle.sql";

const line = (field: string, route: unknown, oracle: unknown, screen: unknown) =>
  console.log(`${field}\troute=${JSON.stringify(route)}\toracle=${JSON.stringify(oracle)}\tscreen=${JSON.stringify(screen)}`);

test.setTimeout(240_000);
test("test_run_summary_totals: route, oracle SQL and screen agree for the mixed run", async ({ page }) => {
  const { up, runId } = await runScenario(page, "mixed");
  const res = await page.request.get(`/api/runs/${runId}/summary`);
  expect(res.status()).toBe(200);
  const s = await res.json();
  const o = await oracleSummary(db(), runId);

  // The scenario really contains each case (the oracle reads the stored rows, not the script).
  expect(o.repairs, "a repair call").toBeGreaterThanOrEqual(1);
  expect(o.truncation_retries, "a truncation retry").toBeGreaterThanOrEqual(1);
  expect(o.lost_calls_rows, "a lost call row").toBeGreaterThanOrEqual(1);
  expect(o.failed, "a failed lesson").toBeGreaterThanOrEqual(1);
  expect((await db().query("select 1 from model_call where run_id=$1 and purpose='repair' and status='completed'", [runId])).length).toBeGreaterThan(0);

  await page.goto(summaryUrl(runId, up.unit_key));
  const raw = await screenFigures(page);
  const fig = new Proxy(raw, { get: (t, k: string) => t[k] ?? "" });
  const other = fig;
  const screenRows = await failuresOnScreen(page);

  line("cost_usd", s.cost_usd, o.cost_usd.toString(), fig["Cost per lesson"]);
  expect(o.cost_usd.equals(new Decimal(String(s.cost_usd)))).toBe(true);
  expect(fig["Cost per lesson"]).toContain(`total ${formatUsd(s.cost_usd)}`);

  line("lessons.ready", s.lessons.ready, o.ready, fig["Cost per lesson"]);
  expect(s.lessons.ready).toBe(o.ready);
  expect(fig["Cost per lesson"]).toContain(`n = ${o.ready} ${o.ready === 1 ? "lesson" : "lessons"}`);

  line("lessons.failed", s.lessons.failed, o.failed, screenRows.reduce((n, r) => n + r.count, 0));
  expect(s.lessons.failed).toBe(o.failed);
  // The screen has no figure for failed lessons; the failures table is reason counts (a lesson can carry several reasons).

  line("retries", s.retries, o.retries, fig["Retries"]);
  expect(s.retries).toBe(o.retries);
  expect(fig["Retries"]?.split(" | ")[0]).toBe(String(o.retries));

  line("truncation_retries", s.truncation_retries, o.truncation_retries, fig["Truncation retries"]);
  expect(s.truncation_retries).toBe(o.truncation_retries);
  expect(other["Truncation retries"]).toBe(String(o.truncation_retries));

  line("calls_lost_in_flight", s.calls_lost_in_flight, o.calls_lost_in_flight, other["Calls lost in flight"]);
  expect(s.calls_lost_in_flight).toBe(o.calls_lost_in_flight);
  expect(other["Calls lost in flight"]).toBe(String(o.calls_lost_in_flight));
  expect(o.calls_lost_in_flight).toBeGreaterThanOrEqual(1);

  const brakeText = o.brakes_fired.length === 0 ? "None" : o.brakes_fired.map((b) => `${b.brake} × ${b.count}`).join(", ");
  line("brakes_fired", s.brakes_fired, o.brakes_fired, other["Brakes fired"]);
  expect(s.brakes_fired).toEqual(o.brakes_fired);
  expect(other["Brakes fired"]).toBe(brakeText);

  line("failures_by_reason", s.failures_by_reason, o.failures_by_reason, screenRows);
  expect(s.failures_by_reason).toEqual(o.failures_by_reason);
  expect(screenRows).toEqual(o.failures_by_reason.map((r) => ({ reason: r.reason, count: r.count })));
  expect(s.n).toBe(o.work);
  expect(s.trace_incomplete).toBe(false);
});
