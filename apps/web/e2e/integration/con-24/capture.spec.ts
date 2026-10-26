// NL-103 AC-1 (WF-20): saving guidance from SCR-21 makes version n+1; a run started before keeps its pin, a run started after pins the new one.
// There is no model_call.prompt_version_id column: the pin is run.prompt_version_id joined on model_call.run_id, plus the marker in rendered_prompt.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import {
  authorSession, calls, currentNumber, driver, driverBg, genBody, getPrompts, marker, openGuidance, pvCount, pvRow, runPin, saveViaUi, startRun,
} from "./helpers";
import { seedL4 } from "./seed";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
test.beforeAll(async ({ browser }) => { test.setTimeout(240_000); await seedL4(browser); });

test("test_prompt_version_capture", async ({ page }) => {
  const { user, up } = await authorSession(page);
  const before = await getPrompts(page);
  const vN = before.current_prompt_version_id;
  const n = currentNumber(before);
  const count0 = await pvCount();
  await openGuidance(page);

  // Run A starts now (pinned to v_n) and is held in the model call so it is still going when the save happens.
  const runA = await startRun(page, await genBody(page, up));
  const driverA = driverBg(["run", runA, "9000"]);
  const [stateA] = await db().query<{ state: string }>("select state from run where id=$1", [runA]);
  expect(["planning", "running", "queued"], "run A is still going at the save").toContain(stateA!.state);

  const mA = marker("A");
  const text = `${mA} be concise`;
  const t0 = Date.now();
  await saveViaUi(page, text, "e2e capture");
  await expect(page.getByRole("status").filter({ hasText: `Guidance v${n + 1} saved. Runs already going keep v${n}.` })).toBeVisible();

  const after = await getPrompts(page);
  const vN1 = after.current_prompt_version_id;
  expect(vN1).not.toBe(vN);
  expect(currentNumber(after)).toBe(n + 1);
  const row = await pvRow(vN1);
  expect(row).toMatchObject({ number: n + 1, author_id: user.user_id, reason: "e2e capture", guidance_text: text });
  expect(Math.abs(new Date(row.created_at).getTime() - t0)).toBeLessThan(120_000);
  expect(row.diff.length).toBeGreaterThan(0);
  expect(row.diff).toContain(mA);
  expect(await pvCount()).toBe(count0 + 1);
  // reload: the new version is still there and selected by default (the rail lists it with its reason)
  await page.reload();
  await expect(page.getByRole("heading", { name: `Guidance v${n + 1}` })).toBeVisible();
  await expect(page.getByRole("list", { name: "Guidance versions" }).getByText("e2e capture").first()).toBeVisible();

  // Run B starts after the save and pins the new version.
  const runB = await startRun(page, await genBody(page, up));
  await driver(["run", runB]);
  await driverA;

  expect(await runPin(runA)).toBe(vN);
  expect(await runPin(runB)).toBe(vN1);
  const ca = await calls(runA);
  const cb = await calls(runB);
  expect(ca.length).toBeGreaterThanOrEqual(1);
  expect(cb.length).toBeGreaterThanOrEqual(1);
  for (const c of ca) expect(c.rendered_prompt).not.toContain(mA);
  for (const c of cb) {
    expect(c.rendered_prompt).toContain(mA);
    expect(c.rendered_prompt.indexOf("### locked")).toBeGreaterThanOrEqual(0);
    expect(c.rendered_prompt.indexOf("### locked")).toBeLessThan(c.rendered_prompt.indexOf("### guidance"));
  }
  const pins = await getPrompts(page);
  const pinned = (id: string) => pins.guidance_versions.find((v) => v.version_id === id)!.pinned_by_runs as unknown as (string | { run_id: string })[];
  const ids = (id: string) => pinned(id).map((x) => (typeof x === "string" ? x : x.run_id));
  expect(ids(vN)).toContain(runA);
  expect(ids(vN1)).toContain(runB);
});
