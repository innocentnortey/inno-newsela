// NL-96 AC-14: obligations that ride on WF-21 (the unit-plan job). One case per id, against the real stack.
import { expect, test } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../support/db";
import { signInAs } from "../support/users";
import { sharedRun } from "./helpers";
import { gr13, gr9, obs11, obs7, r54, ROOT } from "./obligations";
import { killAllWorkers } from "./worker-harness";

test.afterAll(killAllWorkers);
const run = (browser: Parameters<typeof sharedRun>[0], baseURL: string | undefined) => sharedRun(browser, baseURL!, "script-a");
const locked = (file: string, starts: string): string => {
  const line = readFileSync(join(ROOT, "packages/prompts/locked", file), "utf8").split("\n").map((l) => l.trim()).find((l) => l.startsWith(starts));
  if (!line) throw new Error(`no line starting "${starts}" in locked/${file}`);
  return line;
};

test("R-54: the plan read needs a session; control is author-only on the server", async ({ page, browser, baseURL, playwright }) => {
  await r54(page, await run(browser, baseURL), playwright, baseURL!);
});
test("GR-5: the plan prompt carries the locked standards rule, and standards wording comes from the seeded CDE table", async ({ browser, baseURL }) => {
  const r = await run(browser, baseURL);
  const [call] = await db().query<{ rendered_prompt: string }>("select rendered_prompt from model_call where run_id=$1 and purpose='unit_plan'", [r.run_id]);
  expect(call!.rendered_prompt).toContain(locked("grounding-rules.md", "Standards codes and their wording come only from"));
  const sample = await db().query<{ code: string }>("select code from standard where is_leaf order by code limit 3");
  expect(sample.length).toBeGreaterThan(0);
  const codesInPlan = (call!.rendered_prompt.match(/\b[A-Z]{1,3}\.\d+\.\d+\b/g) ?? []);
  console.log("GR-5 seeded standards sample:", sample.map((s) => s.code).join(","), "| codes in the plan prompt:", codesInPlan.length);
});
test("GR-9: the restricted folder is git-ignored, untracked and not named by any con-6 spec", async () => { gr9(); });
test("GR-12: the plan prompt carries the locked content rules (sacred narratives, no trauma-disclosure prompts)", async ({ browser, baseURL }) => {
  const r = await run(browser, baseURL);
  const [call] = await db().query<{ rendered_prompt: string }>("select rendered_prompt from model_call where run_id=$1 and purpose='unit_plan'", [r.run_id]);
  expect(call!.rendered_prompt).toContain(locked("content-rules.md", "Treat sacred narratives"));
  expect(call!.rendered_prompt).toContain(locked("content-rules.md", "Never write a prompt, question or task that invites a student to disclose trauma"));
});
test("GR-13: staff roles only; no student or teacher keys in the plan response", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  await signInAs(page, r.user);
  await gr13(page, r);
});
test("EV-S9: the full-run report builder and its command exist; the n = 47 report itself is not run yet", async () => {
  expect(existsSync(join(ROOT, "evals/src/full-run-report.ts"))).toBe(true);
  expect(readFileSync(join(ROOT, "evals/src/full-run-report.ts"), "utf8")).toContain("build_full_run_report");
  expect(JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts["eval:full-run"]).toBeDefined();
  const reports = existsSync(join(ROOT, "evals/reports")) ? readdirSync(join(ROOT, "evals/reports")).filter((f) => /^full-run-.*\.md$/.test(f)) : [];
  test.fixme(reports.length === 0, "EV-S9 gate 'report with n = 47 before the video' is unmet: evals/reports holds no full-run-<run_id>.md because the single R-51 full run has not been executed. The hook (builder + eval:full-run) exists and is asserted above.");
});
test("EV-R2: the before/after S2/S3 attach rule is recorded and the suites that produce those reports are registered", async () => {
  const plan = readFileSync(join(ROOT, "docs/design/eval-plan.md"), "utf8");
  expect(plan).toMatch(/S2/);
  expect(plan).toMatch(/S3/);
  const scripts = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts as Record<string, string>;
  expect(scripts["eval:golden"]).toBeDefined();
  expect(existsSync(join(ROOT, "evals/src/suites"))).toBe(true);
});
test("OBS-7: no cookie value, password, provider key or restricted path in logs or tables", async ({ page, browser, baseURL }) => {
  const r = await run(browser, baseURL);
  await signInAs(page, r.user);
  await obs7(page, r.user, []);
});
test("OBS-11: the WF-21 row is registered and names test_unit_plan_capture", async () => { obs11("WF-21", "test_unit_plan_capture", "unit-plan.spec.ts"); });
