// NL-90 AC-12/13: obligations that ride on the WF-1 sign-in work (GR-13, OBS-11, GR-9, CON-G1, CON-G8).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { db } from "../support/db";
import { buildOutlineFixtures } from "../support/outline-fixtures";
import { createUser, signInAs } from "../support/users";

const ROOT = resolve(__dirname, "../../../../..");
const WEB = resolve(ROOT, "apps/web");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("GR-13: staff only, no student or teacher accounts or keys", async ({ page }) => {
  const user = await createUser("approver");
  await signInAs(page, user);
  const roles = await db().query<{ role: string }>("select distinct role from app_user");
  for (const r of roles) expect(["author", "reviewer", "approver"]).toContain(r.role);
  const body = JSON.stringify(await (await page.request.get("/api/session")).json());
  expect(body).not.toMatch(/student|teacher/i);
});

test("OBS-11: the WF-1 row is registered and its capture test exists", async () => {
  const doc = readFileSync(join(ROOT, "docs/design/observability.md"), "utf8");
  const row = doc.split("\n").find((l) => l.startsWith("| WF-1 |"));
  expect(row, "WF-1 row").toBeDefined();
  expect(row).toContain("POST /session");
  expect(row).toContain("test_signin_capture");
  expect(existsSync(join(WEB, "e2e/integration/con-1/signin-capture.spec.ts"))).toBe(true);
});

test("GR-9: the restricted source folder is ignored, untracked and never referenced by integration specs", async () => {
  expect(spawnSync("git", ["check-ignore", "-q", "docs/source/restricted/x"], { cwd: ROOT }).status).toBe(0);
  const tracked = spawnSync("git", ["ls-files", "docs/source/restricted"], { cwd: ROOT, encoding: "utf8" });
  expect(tracked.stdout.trim()).toBe("");
  const needle = ["docs", "source", "restricted"].join("/");
  for (const f of walk(join(WEB, "e2e/integration")).filter((p) => p.endsWith(".ts") && !p.endsWith("wf-1-obligations.spec.ts"))) {
    expect(readFileSync(f, "utf8"), f).not.toContain(needle);
  }
});

test("CON-G1: the role comes from the server; a tampered or missing cookie is UNAUTHENTICATED", async ({ page, context, playwright, baseURL }) => {
  const user = await createUser("author");
  await signInAs(page, user);
  const first = await (await page.request.get("/api/session")).json();
  expect(first.user.role).toBe("author");
  await db().query("update app_user set role = 'approver' where id = $1", [user.user_id]);
  const second = await (await page.request.get("/api/session")).json();
  expect(second.user.role).toBe("approver");

  const cookie = (await context.cookies()).find((c) => c.name === "ls_session")!;
  const tampered = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Cookie: `ls_session=${cookie.value}x` },
  });
  const t = await tampered.get("/api/session");
  expect(t.status()).toBe(401);
  expect((await t.json()).error.code).toBe("UNAUTHENTICATED");
  await tampered.dispose();

  const bare = await playwright.request.newContext({ baseURL });
  const m = await bare.get("/api/session");
  expect(m.status()).toBe(401);
  expect((await m.json()).error.code).toBe("UNAUTHENTICATED");
  await bare.dispose();
});

test("CON-G8: no review or minutes keys and no person name beyond user.name", async ({ page }) => {
  const user = await createUser("reviewer");
  await signInAs(page, user);
  const session = await (await page.request.get("/api/session")).json();
  const keys: string[] = [];
  const collect = (v: unknown) => {
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) (keys.push(k), collect(x));
  };
  collect(session);
  expect(keys.filter((k) => /review|minutes/i.test(k))).toEqual([]);
  expect(Object.keys(session.user).filter((k) => /name/.test(k))).toEqual(["name"]);

  const rows = await db().query<{ details_json: unknown }>("select details_json from audit_event where actor_id = $1", [user.user_id]);
  expect(rows.length).toBeGreaterThan(0);
  const text = JSON.stringify(rows.map((r) => r.details_json));
  expect(text).not.toMatch(/"[^"]*(review|minutes)[^"]*"\s*:/i);
  expect(text).not.toContain(user.name);
});

test("outline fixtures: the helper writes a CSV with a header and three lesson rows", async ({}, testInfo) => {
  const { csv, xlsx } = buildOutlineFixtures([0, 1, 2], testInfo.outputDir);
  expect(existsSync(xlsx)).toBe(true);
  const lines = readFileSync(csv, "utf8").split("\n");
  expect(lines[0]).toMatch(/^# source: docs\/data\/samples\/g6-u4-lesson-outline\.json rows 0,1,2$/);
  // cells hold line breaks, so count rows by parsing the CSV body, not by splitting lines
  const rows = XLSX.utils.sheet_to_json<string[]>(XLSX.read(lines.slice(1).join("\n"), { type: "string" }).Sheets["Sheet1"]!, { header: 1 });
  expect(rows).toHaveLength(4);
});
