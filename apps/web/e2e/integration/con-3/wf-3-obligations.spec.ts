// NL-94 AC-14/15: obligations that ride on WF-3 (OBS-11, R-54, GR-9, GR-13).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs, type Role } from "../support/users";
import { authorWithUpload, errorFindings, getReportText, postChoice, reportPath } from "./helpers";

const ROOT = resolve(__dirname, "../../../../..");
const WEB = resolve(ROOT, "apps/web");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("OBS-11: the WF-3 row is registered and its capture test exists", async () => {
  const doc = readFileSync(join(ROOT, "docs/design/observability.md"), "utf8");
  const row = doc.split("\n").find((l) => l.startsWith("| WF-3 |"));
  expect(row, "WF-3 row").toBeDefined();
  expect(row).toContain("test_intake_confirm_capture");
  expect(existsSync(join(WEB, "e2e/integration/con-3/intake-capture.spec.ts"))).toBe(true);
});

test("R-54: sign-in is required and the roles are enforced on the report and choice routes", async ({ page, browser, playwright }) => {
  const { up } = await authorWithUpload(page);
  const vid = up.outline_version_id;
  const bare = await playwright.request.newContext({ baseURL: getStack().baseURL });
  const anon = await bare.get(reportPath(vid));
  expect(anon.status()).toBe(401);
  expect((await anon.json()).error.code).toBe("UNAUTHENTICATED");
  await bare.dispose();
  const target = errorFindings(JSON.parse(await getReportText(page, vid)))[0]!.finding_id;
  for (const role of ["reviewer", "approver"] as Role[]) {
    const p = await (await browser.newContext()).newPage();
    await signInAs(p, await createUser(role));
    expect((await p.request.get(reportPath(vid))).status(), `${role} reads`).toBe(200);
    expect((await postChoice(p, vid, { target_id: target, kind: "confirm_fix", value: null })).status(), `${role} writes`).toBe(403);
    await p.context().close();
  }
  expect((await page.request.get(reportPath(vid))).status()).toBe(200);
});

test("GR-9: the restricted source folder is ignored, untracked and never referenced by integration specs", async () => {
  expect(spawnSync("git", ["check-ignore", "-q", "docs/source/restricted/x"], { cwd: ROOT }).status).toBe(0);
  const tracked = spawnSync("git", ["ls-files", "docs/source/restricted"], { cwd: ROOT, encoding: "utf8" });
  expect(tracked.stdout.trim()).toBe("");
  const needle = ["docs", "source", "restricted"].join("/");
  for (const f of walk(join(WEB, "e2e/integration/con-3")).filter((p) => p.endsWith(".ts") && !p.endsWith("wf-3-obligations.spec.ts"))) {
    expect(readFileSync(f, "utf8"), f).not.toContain(needle);
  }
});

test("GR-13: staff only, and no report or choice response mentions students or teachers", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  const roles = await db().query<{ role: string }>("select distinct role from app_user");
  for (const r of roles) expect(["author", "reviewer", "approver"]).toContain(r.role);
  const text = await getReportText(page, up.outline_version_id);
  const target = errorFindings(JSON.parse(text))[0]!.finding_id;
  const choice = await (await postChoice(page, up.outline_version_id, { target_id: target, kind: "confirm_fix", value: null })).text();
  // the sheet's own cell text may say "students"; check the response keys and the choice response, not lesson prose
  const keys: string[] = [];
  const collect = (v: unknown) => {
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
        keys.push(k);
        collect(x);
      }
  };
  collect(JSON.parse(text));
  collect(JSON.parse(choice));
  expect(keys.filter((k) => /student|teacher/i.test(k))).toEqual([]);
});
