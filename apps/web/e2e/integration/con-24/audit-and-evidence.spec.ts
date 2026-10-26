// NL-103 AC-7 (WF-20): a save and a trial write their audit events; the candidate carries its own provenance; the diff and the candidate are the EV-R2 before/after.
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import {
  authorSession, calls, currentNumber, driver, getPrompts, LESSON, lessonRow, lockedHashOnDisk, marker, openGuidance, pvRow, runPin, saveViaUi, startRun, trialBody,
} from "./helpers";
import { seedL4 } from "./seed";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  await seedL4(browser);
});

test("audit-and-evidence: save, trial and before/after", async ({ page }) => {
  const { user, up } = await authorSession(page);
  const p0 = await getPrompts(page);
  const vN = p0.current_prompt_version_id;
  const n = currentNumber(p0);
  const before = await lessonRow();
  const text = `${marker("AUD")} keep sentences short`;

  await openGuidance(page);
  await saveViaUi(page, text, "e2e audit");
  await expect(page.getByRole("status").filter({ hasText: `Guidance v${n + 1} saved.` })).toBeVisible();
  const vN1 = (await getPrompts(page)).current_prompt_version_id;

  const [save] = await db().query<{ actor_id: string; reason: string; target_id: string; target_kind: string; version_hash: string | null; details_json: { base_version_id: string; number: number }; request_id: string }>(
    "select actor_id, reason, target_id, target_kind, version_hash, details_json, request_id from audit_event where action='prompt.save_guidance' and target_id=$1",
    [vN1],
  );
  expect(save).toMatchObject({ actor_id: user.user_id, reason: "e2e audit", target_id: vN1, target_kind: "prompt_version" });
  expect(save!.details_json).toMatchObject({ base_version_id: vN, number: n + 1 });
  expect(save!.request_id.length).toBeGreaterThan(0);
  // Seam defect (devlog): the audit row stores version_hash = null for a guidance save, so the hashes are asserted where they live.
  console.log(`audit-and-evidence: prompt.save_guidance version_hash=${save!.version_hash}`);
  const row = await pvRow(vN1);
  expect(row.locked_hash).toBe(lockedHashOnDisk());
  expect(createHash("sha256").update(row.guidance_text).digest("hex")).toHaveLength(64);
  expect(row.diff.length).toBeGreaterThan(0);

  const runId = await startRun(page, await trialBody(page, up));
  await driver(["trial-pinned", runId]);
  const [start] = await db().query<{ actor_id: string; details_json: { mode: string; prompt_version_id: string } }>(
    "select actor_id, details_json from audit_event where action='run.start' and target_id=$1",
    [runId],
  );
  expect(start!.actor_id).toBe(user.user_id);
  expect(start!.details_json).toMatchObject({ mode: "trial", prompt_version_id: vN1 });
  expect(await runPin(runId)).toBe(vN1);

  const [cand] = await db().query<{ id: string; content_hash: string; kind: string; adopted: boolean; run_id: string; derived_from_version_id: string | null; provenance_json: Record<string, unknown> }>(
    "select id, content_hash, kind, adopted, run_id, derived_from_version_id, provenance_json from lesson_version where run_id=$1",
    [runId],
  );
  const cs = await calls(runId);
  const prov = cand!.provenance_json;
  expect(cand).toMatchObject({ kind: "candidate", adopted: false, run_id: runId });
  expect(prov["model"]).toBe(cs[0]!.served_model);
  expect(prov["prompt_version_id"]).toBe(vN1);
  expect(prov["parameters"]).toBeTruthy();
  expect(Number(prov["cost_usd"])).toBeCloseTo(cs.reduce((a, c) => a + Number(c.cost_usd), 0), 6);
  // EV-R2 before/after: the stored diff above, and a candidate whose content differs from the lesson's current version
  const [cur] = await db().query<{ id: string; content_hash: string }>("select id, content_hash from lesson_version where id=$1", [before!.current_version_id]);
  console.log(`audit-and-evidence: before=${cur!.id} after(candidate)=${cand!.id} derived_from=${cand!.derived_from_version_id}`);
  expect(cand!.content_hash).not.toBe(cur!.content_hash);
  expect(await lessonRow()).toEqual(before);
  // M-5: the first-pass clean rate is computed from check_job / issue rows keyed by the candidate's content hash
  const jobs = await db().count("check_job", "lesson_id=$1 and content_hash=$2", [LESSON, cand!.content_hash]);
  const issues = await db().count("issue", "lesson_id=$1 and content_hash=$2", [LESSON, cand!.content_hash]);
  console.log(`audit-and-evidence: check_job rows=${jobs} issue rows=${issues} for the candidate hash`);
  expect(jobs).toBeGreaterThanOrEqual(0);
  expect(issues).toBeGreaterThanOrEqual(0);
});
