/* eslint-disable @typescript-eslint/no-explicit-any -- parsed JSON response bodies from the real stack are untyped */
// NL-113 AC-16 (coverage): WF-10's PRD obligations, one case each, driving the check lane on the real stack.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { endFlow, expertFraming, noNamedMinutes, observabilityRow, registered, restrictedFolderRule, startFlow, authorForbidden, staffOnly, printPassed, type Flow } from "./obligations";
import { issuesOf } from "./helpers";
import { stopLive } from "./stack";

test.describe.configure({ mode: "serial" });
let f: Flow | undefined;
const passed: string[] = [];
test.beforeAll(async ({ browser }) => {
  f = await startFlow(browser);
});
test.afterAll(async () => {
  await endFlow(f);
  await stopLive();
});
const done = (id: string) => passed.push(id);

test("R-14: the check lane flags the stored lesson's missing ELD callout roles (ELD structure is checked, not generated here)", async () => {
  const list = (await issuesOf(f!.reviewer.page, f!.lesson.lessonId)).body;
  const eld = list.issues.filter((i: any) => i.kind === "section_missing" && /eld_callout_(purpose|say|watch)/.test(i.message));
  expect(eld.length).toBeGreaterThanOrEqual(3);
  done("R-14");
});

test("R-15: the check lane flags standards with no Pulse Check item (typed CFU structure is checked)", async () => {
  const list = (await issuesOf(f!.reviewer.page, f!.lesson.lessonId)).body;
  expect(list.issues.some((i: any) => i.kind === "standard_not_checked" && /Pulse Check/.test(i.message))).toBe(true);
  done("R-15");
});

test("GR-13: staff roles only; no student or teacher-of-record column anywhere", async () => {
  await staffOnly();
  done("GR-13");
});

test("GR-16: SCR-9 copy frames the tool as expert-driven", async () => {
  await expertFraming(f!.reviewer.page, f!.lesson);
  done("GR-16");
});

test("GR-18: the locked prompt layer is not editable from SCR-9 (file presence: no prompt editor in the workspace feature)", async () => {
  const { spawnSync } = await import("node:child_process");
  const { ROOT } = await import("./obligations");
  const hit = spawnSync("grep", ["-rliE", "prompt_?(layer|editor)|PromptEditor|locked_prompt", "apps/web/src/features/workspace"], { cwd: ROOT, encoding: "utf8" });
  expect(hit.stdout.trim()).toBe("");
  const page = f!.reviewer.page;
  expect(await page.locator("textarea[name*=prompt i], [data-testid*=prompt i]").count()).toBe(0);
  done("GR-18");
});

test("CON-G1: an author's resolution is ROLE_FORBIDDEN on the server", async () => {
  const list = (await issuesOf(f!.reviewer.page, f!.lesson.lessonId)).body;
  const target = list.issues.find((i: any) => i.resolvable);
  await authorForbidden(f!, `/lessons/${f!.lesson.lessonId}/issues/${target.issue_id}/resolution`, { reason: "author" });
  done("CON-G1");
});

test("CON-G8: no route in the flow returns review minutes with a person's name", async () => {
  await noNamedMinutes(f!);
  done("CON-G8");
});

test("EV-R2: (doc obligation, checked by row presence) the eval plan names the S2/S3 report and cost for a check change", async () => {
  const { readFileSync } = await import("node:fs");
  const { ROOT } = await import("./obligations");
  const plan = readFileSync(`${ROOT}/docs/design/eval-plan.md`, "utf8");
  expect(plan).toMatch(/S2/);
  expect(plan).toMatch(/S3/);
  expect(plan.toLowerCase()).toContain("cost");
  void db;
  done("EV-R2");
});

test("OBS-11: WF-10 is registered and its capture test file exists", async () => {
  registered("WF-10", "test_checks_after_store_capture", "con-13/store-checks.spec.ts");
  expect(observabilityRow("WF-10")).toContain("5 s");
  done("OBS-11");
});

test("restricted folder rule holds for this folder's specs (GR-9 rides along)", async () => {
  restrictedFolderRule();
});

test("passed obligation ids", async () => {
  printPassed("wf-10", passed);
  expect(passed.sort()).toEqual(["CON-G1", "CON-G8", "EV-R2", "GR-13", "GR-16", "GR-18", "OBS-11", "R-14", "R-15"]);
});
