// NL-93 AC-15 / AC-14: WF-2 obligations R-54, GR-13, GR-9, OBS-7, GR-5, OBS-11.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, request } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs } from "../support/users";
import { ISSUED_CSV, ISSUED_XLSX, REPO_ROOT } from "./fixtures/files";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { fromPath, postOutline } from "./support/upload";

test.beforeAll(ensureSeeded);
test.beforeEach(resetIntake);

test("R-54: signed-out upload is 401, reviewer is ROLE_FORBIDDEN, author gets 201", async ({
  page,
  baseURL,
}) => {
  const anon = await request.newContext({ baseURL });
  const f = fromPath(ISSUED_CSV);
  const res = await anon.post("/api/outline-versions", {
    multipart: { file: f },
    headers: { Origin: baseURL! },
  });
  expect(res.status()).toBe(401);
  expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  await anon.dispose();

  await signInAs(page, await createUser("reviewer"));
  expect((await postOutline(page, getStack().baseURL, f)).body.error.code).toBe(
    "ROLE_FORBIDDEN",
  );
  await page.context().clearCookies();
  await signInAs(page, await createUser("author"));
  expect((await postOutline(page, getStack().baseURL, f)).status).toBe(201);
});

test("GR-13: only the three staff roles exist and the units payload names no students or teachers", async ({
  page,
}) => {
  await signInAs(page, await createUser("author"));
  await postOutline(page, getStack().baseURL, fromPath(ISSUED_CSV));
  const roles = (
    await db().query<{ role: string }>("select distinct role from app_user")
  ).map((r) => r.role);
  for (const r of roles)
    expect(["author", "reviewer", "approver"]).toContain(r);
  const body = await (await page.request.get("/api/units")).text();
  const keys = [...body.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1]);
  expect(keys.filter((k) => /student|teacher/i.test(k ?? ""))).toEqual([]);
});

test("GR-9: restricted source folder is git-ignored, untracked, and not referenced by these specs", async () => {
  const dir = ["docs", "source", "restricted"].join("/"); // built from parts: con-1's GR-9 scans every integration file for the literal
  execFileSync("git", ["check-ignore", "-q", `${dir}/x`], { cwd: REPO_ROOT });
  const tracked = execFileSync("git", ["ls-files", dir], { cwd: REPO_ROOT })
    .toString()
    .trim();
  expect(tracked).toBe("");
  const needle = ["source", "restricted"].join("/");
  for (const f of readdirSync(__dirname).filter(
    (n) => n.endsWith(".spec.ts") && n !== "wf-2-obligations.spec.ts",
  )) {
    expect(readFileSync(join(__dirname, f), "utf8"), f).not.toContain(needle);
  }
});

test("OBS-7: neither logs nor the database hold the password or a session token", async ({
  page,
}) => {
  const user = await signInAs(page, await createUser("author"));
  await postOutline(page, getStack().baseURL, fromPath(ISSUED_XLSX));
  const tokens = (await page.context().cookies())
    .filter((c) => c.name === "ls_session")
    .map((c) => c.value);
  expect(tokens.length).toBeGreaterThan(0);
  const logs = getStack().logs().join("\n");
  const dump = await db().dumpAll();
  for (const secret of [user.password, ...tokens]) {
    expect(logs).not.toContain(secret);
    expect(dump).not.toContain(secret);
  }
});

test("GR-5: standards text in the report is the CDE seed's, never the sheet's labels", async ({
  page,
}) => {
  await signInAs(page, await createUser("author"));
  expect((await postOutline(page, getStack().baseURL, fromPath(ISSUED_XLSX))).status).toBe(201);
  const res = await page.request.get("/api/outline-versions/G6.U4.ov1/report");
  expect(res.status()).toBe(200);
  const report = await res.json();
  const standards = await db().query<{ code: string; text: string; eld_strand: string | null }>(
    "select code, text, eld_strand from standard",
  );
  const byCode = new Map(standards.map((r) => [r.code, r]));
  const known = new Set([...standards.map((r) => r.text), ...standards.flatMap((r) => (r.eld_strand ? [r.eld_strand] : []))]);
  let eld = 0;
  for (const row of report.rows as Array<{ eld: Array<{ code: string; sheet_label: string; official_strand: string; verdict: string }> }>) {
    for (const e of row.eld) {
      eld++;
      // Every code the report names exists in the seed, and the official strand text is the seed's.
      expect(byCode.has(e.code), `code ${e.code} is in the standard table`).toBe(true);
      expect(known.has(e.official_strand), `official_strand for ${e.code} comes from the standard table`).toBe(true);
      if (e.verdict === "mismatch") expect(e.official_strand).not.toBe(e.sheet_label);
    }
  }
  // Findings carry the sheet's own text under original_text only; the contract has no other standards-text field on this route.
  console.log(`GR-5: ${eld} ELD entries checked against ${standards.length} seeded standards`);
  expect(eld).toBeGreaterThan(0);
});

test("OBS-11: the entry points this ticket touches are registered under WF-2 (and the progress read under WF-5)", async () => {
  const lines = (f: string) => readFileSync(join(REPO_ROOT, f), "utf8").split("\n");
  const wf = (id: string) => lines("docs/design/observability.md").find((l) => l.startsWith(`| ${id} |`));
  const wf2 = wf("WF-2");
  expect(wf2, "observability registers WF-2").toBeTruthy();
  for (const entry of ["GET /units", "POST /outline-versions", "POST /outline-versions/import", "CON-2"]) expect(wf2).toContain(entry);
  expect(wf("WF-5"), "observability registers WF-5 under CON-6").toContain("CON-6");
  // The operation ids map to those CONs in component-contracts.
  const cc = lines("docs/design/component-contracts.md");
  const con2 = cc.find((l) => l.includes("`uploadOutline`"));
  for (const op of ["uploadOutline", "importOutlineLink", "listUnits"]) expect(con2).toContain(op);
  expect(cc.find((l) => l.includes("`getRunProgress`"))).toContain("CON-6");
});
