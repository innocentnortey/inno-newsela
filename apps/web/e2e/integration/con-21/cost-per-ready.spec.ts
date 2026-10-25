// NL-97 AC-2: cost per ready lesson = all calls' cost (failed attempts included) / ready lessons; empty when none ready.
import Decimal from "decimal.js";
import { expect, test } from "@playwright/test";
import { settle_cost } from "@ls/core/spend/reservation";
import { db } from "../support/db";
import { formatUsd } from "../../../src/features/run-summary/format";
import { getSummary, runScenario, screenFigures, summaryUrl } from "./helpers";
import { oracleSummary } from "./oracle.sql";

// The driver prices the stub model like world.ts stub_prices(): input 2.00, output 10.00, cache read 0.20, write 2.50 per Mtok.
const price = { model_id: "stub-model", input_per_mtok: new Decimal("2.00"), output_per_mtok: new Decimal("10.00"), cache_read_per_mtok: new Decimal("0.20"), cache_write_per_mtok: new Decimal("2.50") };

test("cost-per-ready: failed attempts are in the numerator and every call cost is settle_cost of its usage", async ({ page }) => {
  const { up, runId } = await runScenario(page, "mixed");
  const o = await oracleSummary(db(), runId);
  const s = await getSummary(page, runId);
  expect(o.ready).toBeGreaterThan(0);
  expect(o.cost_failed_lessons.greaterThan(0), "a failed lesson spent money").toBe(true);
  const readyOnly = o.cost_all_calls.minus(o.cost_failed_lessons).div(o.ready);
  const expected = o.cost_all_calls.div(o.ready);
  expect(expected.equals(readyOnly), "numerator must differ once the failed attempt is counted").toBe(false);
  expect(s.cost_per_ready_lesson_usd).not.toBeNull();
  const got = new Decimal(String(s.cost_per_ready_lesson_usd));
  console.log(`cost_per_ready route=${got} oracle=${expected} (ready-only numerator would be ${readyOnly})`);
  expect(got.toDecimalPlaces(12).equals(expected.toDecimalPlaces(12))).toBe(true);

  const calls = await db().query<Record<string, string | number>>("select * from model_call where run_id=$1 and status='completed'", [runId]);
  expect(calls.length).toBeGreaterThan(2);
  for (const c of calls) {
    const want = settle_cost(price as never, { input_tokens: Number(c["input_tokens"]), output_tokens: Number(c["output_tokens"]), cache_read_tokens: Number(c["cache_read_tokens"]), cache_write_tokens: Number(c["cache_write_tokens"]) });
    expect(new Decimal(String(c["cost_usd"])).equals(want), `call ${c["id"]}`).toBe(true);
  }
  await page.goto(summaryUrl(runId, up.unit_key));
  const fig = await screenFigures(page);
  expect(fig["Cost per lesson"]).toContain(formatUsd(s.cost_per_ready_lesson_usd as number));
});

test("cost-per-ready: no ready lesson gives null on the wire and the empty marker on screen", async ({ page }) => {
  const { up, runId } = await runScenario(page, "fails");
  const o = await oracleSummary(db(), runId);
  expect(o.ready).toBe(0);
  const s = await getSummary(page, runId);
  expect(s.cost_per_ready_lesson_usd).toBeNull();
  await page.goto(summaryUrl(runId, up.unit_key));
  const fig = await screenFigures(page);
  expect(fig["Cost per lesson"]).toContain("No ready lessons yet");
});
