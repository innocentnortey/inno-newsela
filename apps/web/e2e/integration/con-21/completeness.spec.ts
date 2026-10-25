// NL-97 AC-4: RunFinalizer.completeness is clean for a finished run; removing one stored call makes the silence visible.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getSummary, probeCompleteness, runScenario } from "./helpers";

test.setTimeout(240_000);
test("completeness: finished run is complete, a missing call row is reported, restoring it clears the report", async ({ page }) => {
  const { runId } = await runScenario(page, "repaired");
  const before = await db().count("model_call", "run_id=$1", [runId]);
  expect((await getSummary(page, runId)).trace_incomplete).toBe(false);
  const r = await probeCompleteness(runId);
  console.log("completeness", JSON.stringify(r));
  expect(r.before.summary_matches_calls).toBe(true);
  expect(r.before.terminal_jobs_without_calls).toEqual([]);
  // The finalizer reads through its own pool, so the removal is a committed delete restored in a finally block (devlog).
  expect(r.removed.summary_matches_calls === false || r.removed.terminal_jobs_without_calls.length > 0, "mismatch must be reported").toBe(true);
  expect(r.restored.summary_matches_calls).toBe(true);
  expect(r.restored.terminal_jobs_without_calls).toEqual([]);
  expect(await db().count("model_call", "run_id=$1", [runId])).toBe(before);
  expect((await getSummary(page, runId)).trace_incomplete).toBe(false);
});
