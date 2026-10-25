// NL-96 AC-5 (WF-6): Retry failed re-queues only the failed job; ready lessons' hashes stay; the cap holds; one audit row per click.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { FLEX, L4, L5, getProgress, startRun, progressUrl, waitRun, waitSql, settleAll } from "./helpers";
import { startWorker } from "./worker-harness";

test.afterEach(async ({ page }) => settleAll(page));

test("test_run_control_capture: Retry failed re-queues exactly the failed lesson, hashes unchanged, under the cap, one audit event", async ({ page }) => {
  test.setTimeout(240_000);
  const cap = 13;
  const run = await startRun(page, [8, 9, 25], cap);
  const worker = await startWorker({ script: "script-a" });
  await waitRun(run.run_id, ["partial"]);
  const hashes = async () => db().query<{ lesson_id: string; content_hash: string; n: number }>("select lesson_id, content_hash, number n from lesson_version where run_id=$1 order by lesson_id, number", [run.run_id]);
  const before = await hashes();
  expect(before.map((h) => h.lesson_id).sort()).toEqual([L4, L5]);
  const prog = await getProgress(page, run.run_id);
  const failed = prog.tiles.filter((t) => t.tile_state === "failed");
  expect(failed.map((t) => t.lesson_id)).toEqual([FLEX]);
  expect(failed[0]!.repair_used).toBe(true); // it failed after one repair
  const controlAudit = () => db().count("audit_event", "target_id=$1 and action like 'run.%' and action <> 'run.start'", [run.run_id]);
  const a0 = await controlAudit();
  const calls0 = worker.calls().length;
  const job = () => db().query<{ attempt: number; status: string }>("select attempt, status from lesson_job where run_id=$1 and lesson_id=$2 and kind='lesson'", [run.run_id, FLEX]);
  const attempt0 = (await job())[0]!.attempt;
  const mc0 = await db().count("model_call", "run_id=$1", [run.run_id]);

  const over: string[] = [];
  const watcher = setInterval(() => {
    void db().query<{ t: string }>("select spent_usd + reserved_usd as t, cap_usd from (select coalesce((select sum(settled_usd) from spend_reservation where run_id=$1),0) spent_usd, coalesce((select sum(reserved_usd) from spend_reservation where run_id=$1 and status='reserved'),0) reserved_usd, $2::numeric cap_usd) x", [run.run_id, cap]).then((r) => { if (Number(r[0]!.t) > cap) over.push(r[0]!.t); }, () => undefined);
  }, 100);
  const polled: string[] = [];
  page.on("response", async (r) => { if (/\/progress$/.test(r.url())) { try { const j = (await r.json()) as { spent_usd: number; reserved_usd: number; cap_usd: number }; if (j.spent_usd + j.reserved_usd > j.cap_usd + 1e-9) polled.push(JSON.stringify(j)); } catch { /* page closing */ } } });

  await page.goto(progressUrl(run));
  const resp = page.waitForResponse((r) => r.url().endsWith(`/api/runs/${run.run_id}/actions`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Retry failed" }).click();
  const res = await resp;
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { requeued_lessons: string[]; state: string };
  console.log("AC-5 retry response:", JSON.stringify(body));
  expect(body.requeued_lessons).toEqual([FLEX]);
  await waitSql(job, (j) => j[0]!.attempt > attempt0 && !["queued", "running"].includes(j[0]!.status), 60_000);
  await waitRun(run.run_id, ["partial", "complete"]);
  // The failed lesson's draft and repair were already paid for: the retry reuses them and pays for nothing new.
  console.log(`AC-5 FLEX attempt ${attempt0} -> ${(await job())[0]!.attempt}; model calls before ${mc0}, after ${await db().count("model_call", "run_id=$1", [run.run_id])}; worker calls before ${calls0}, after ${worker.calls().length}`);
  expect(await db().count("model_call", "run_id=$1", [run.run_id])).toBe(mc0);
  clearInterval(watcher);
  const after = await hashes();
  expect(after).toEqual(before); // ready lessons: same rows, same content_hash, no new version
  expect(worker.calls().filter((c) => c.lesson === L4 || c.lesson === L5).length).toBe(worker.calls().slice(0, calls0).filter((c) => c.lesson === L4 || c.lesson === L5).length);
  expect(over, "reserved+spent over the cap").toEqual([]);
  expect(polled, "progress reads over the cap").toEqual([]);
  expect(await controlAudit()).toBe(a0 + 1);
  const rows = await db().query<{ action: string }>("select action from audit_event where target_id=$1 and action <> 'run.start'", [run.run_id]);
  console.log("AC-5 control audit rows:", JSON.stringify(rows), "hashes:", JSON.stringify(before.map((b) => [b.lesson_id, b.content_hash.slice(0, 10)])));
  expect(rows.map((r) => r.action)).toEqual(["run.retry_failed"]);
});
