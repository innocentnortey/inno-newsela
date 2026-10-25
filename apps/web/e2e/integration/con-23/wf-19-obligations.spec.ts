// NL-102 AC-13: obligations that ride on WF-19 (R-54, GR-9, GR-13, CON-G8, OBS-3, OBS-7, OBS-11). One test per id.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, request as pwRequest } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { as, auditRows, createExport, download, exportsApi, listExports, origin, type Created } from "./helpers";
import { approverUser, ensureSeeded, freshUnit, seedApproved } from "./seed";

test.setTimeout(240_000);
const ROOT = resolve(__dirname, "../../../../..");
const HERE = __dirname;
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

async function approverUnit() {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  await seedApproved({ unit, number: 1, approver_id: approver.user_id });
  await seedApproved({ unit, number: 2, approver_id: approver.user_id });
  return { unit, approver };
}

test("R-54: no cookie gets 401 UNAUTHENTICATED; author and reviewer get 403; the approver gets 200", async ({ page }) => {
  const { unit, approver } = await approverUnit();
  await as(page, approver);
  const c = (await (await createExport(page, unit.unit_key)).json()) as Created;
  const dl = `/api/exports/${c.export_id}/download`;
  const anon = await pwRequest.newContext({ baseURL: getStack().baseURL });
  for (const [m, url] of [["get", exportsApi(unit.unit_key)], ["post", exportsApi(unit.unit_key)], ["get", dl]] as const) {
    const res = await anon[m](url, { headers: origin() });
    expect(res.status(), `${m} ${url}`).toBe(401);
    expect(((await res.json()) as { error?: { code?: string } }).error?.code).toBe("UNAUTHENTICATED");
  }
  await anon.dispose();
  for (const role of ["author", "reviewer"] as const) {
    await page.context().clearCookies();
    await as(page, role);
    for (const res of [await page.request.get(exportsApi(unit.unit_key)), await createExport(page, unit.unit_key), await page.request.get(dl)]) {
      expect(res.status(), role).toBe(403);
    }
  }
  await page.context().clearCookies();
  await as(page, approver);
  expect((await page.request.get(exportsApi(unit.unit_key))).status()).toBe(200);
  expect((await page.request.get(dl)).status()).toBe(200);
});

test("GR-9: the restricted source folder is ignored, untracked and never referenced by con-23", async () => {
  expect(spawnSync("git", ["check-ignore", "-q", "docs/source/restricted/x"], { cwd: ROOT }).status).toBe(0);
  expect(spawnSync("git", ["ls-files", "docs/source/restricted"], { cwd: ROOT, encoding: "utf8" }).stdout.trim()).toBe("");
  const needle = ["docs", "source", "restricted"].join("/");
  for (const f of walk(HERE).filter((p) => !p.endsWith("wf-19-obligations.spec.ts"))) expect(readFileSync(f, "utf8"), f).not.toContain(needle);
});

test("GR-13: staff roles only and no student or teacher data keys in the export responses", async ({ page }) => {
  const { unit, approver } = await approverUnit();
  await as(page, approver);
  for (const r of await db().query<{ role: string }>("select distinct role from app_user")) expect(["author", "reviewer", "approver"]).toContain(r.role);
  const created = await createExport(page, unit.unit_key);
  const c = (await created.json()) as Created;
  const bodies = [JSON.stringify(c), JSON.stringify(await listExports(page, unit.unit_key))];
  const keys = (v: unknown): string[] => (v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [k, ...keys(x)]) : []);
  for (const b of bodies) expect(keys(JSON.parse(b)).filter((k) => /student|teacher_id|teacher_name/i.test(k))).toEqual([]);
  const file = await download(page, c.export_id);
  expect(Object.keys(file.body).sort()).toEqual(["export_version", "generated_at", "lessons", "unit_id"]);
});

test("CON-G8: no export response carries review-time figures or a person's name or email", async ({ page }) => {
  const { unit, approver } = await approverUnit();
  await as(page, approver);
  const created = await (await createExport(page, unit.unit_key)).text();
  const c = JSON.parse(created) as Created;
  const list = JSON.stringify(await listExports(page, unit.unit_key));
  const file = await download(page, c.export_id);
  const people = await db().query<{ name: string; email: string }>("select name, email from app_user");
  const names = people.map((r) => r.name);
  const emails = people.map((r) => r.email);
  for (const [what, text] of [["create", created], ["list", list], ["download", file.text]] as const) {
    // Review/editing time (heartbeat minutes) is the sensitive figure; a section's planned "minutes" is lesson content.
    expect(text, `${what}: review-time key`).not.toMatch(/"(review|reviewer|editing|active|heartbeat)_?(minutes|seconds)/i);
    for (const n of [...names, ...emails]) expect(text, `${what}: name ${n}`).not.toContain(n);
  }
});

test("OBS-3: the request id is on the response, in the log lines and on the audit row", async ({ page }) => {
  const { unit, approver } = await approverUnit();
  await as(page, approver);
  const res = await createExport(page, unit.unit_key);
  const rid = res.headers()["x-request-id"];
  expect(rid).toBeTruthy();
  const c = (await res.json()) as Created;
  const audit = await auditRows(c.export_id);
  expect(audit[0]!.request_id).toBe(rid);
  const lines = (): { event?: string; request_id?: string; extra?: { operation_id?: string; status?: number } }[] =>
    getStack().logs().flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  await expect.poll(() => lines().some((l) => l.request_id === rid && l.event === "route.done" && l.extra?.operation_id === "createExport")).toBe(true);
  const dl = await page.request.get(`/api/exports/${c.export_id}/download`);
  const drid = dl.headers()["x-request-id"];
  expect(drid).toBeTruthy();
  await expect.poll(() => lines().some((l) => l.request_id === drid && l.event === "route.done" && l.extra?.operation_id === "downloadExport")).toBe(true);
});

test("OBS-7: no provider key, password or restricted path in the database dump or the logs", async ({ page }) => {
  const { unit, approver } = await approverUnit();
  await as(page, approver);
  expect((await createExport(page, unit.unit_key)).status()).toBe(201);
  const dump = await db().dumpAll();
  expect(dump.length).toBeGreaterThan(5000);
  const logs = getStack().logs().join("\n");
  for (const [name, text] of [["database dump", dump], ["web logs", logs]] as const) {
    expect(text, `${name}: provider key`).not.toMatch(/sk-(ant-|or-)?[A-Za-z0-9_-]{16,}/);
    expect(text, `${name}: plain password`).not.toContain(approver.password);
    expect(text, `${name}: restricted path`).not.toContain(["docs", "source", "restricted"].join("/"));
  }
});

test("OBS-11: the WF-19 row is registered and its verification spec exists", async () => {
  const doc = readFileSync(join(ROOT, "docs/design/observability.md"), "utf8");
  const row = doc.split("\n").find((l) => l.startsWith("| WF-19 |"));
  console.log(`observability.md WF-19 row: ${row?.slice(0, 160)}`);
  expect(row).toBeTruthy();
  expect(existsSync(join(HERE, "capture.spec.ts"))).toBe(true);
  expect(readFileSync(join(HERE, "capture.spec.ts"), "utf8")).toContain("test_export_capture");
  expect(readFileSync(join(ROOT, ".claude/reference/area-map.md"), "utf8")).toContain("wiring/exports.ts");
});
