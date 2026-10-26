// NL-95 AC-13/14: obligations that ride on WF-4 (GR-13, CON-G8, SCR-21, R-54, GR-9, CON-G4, OBS-7, OBS-11).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { signInAs, type Role } from "../support/users";
import { authorWithConfirmedUpload, runBody, startRunApi, uniqueKey } from "./helpers";

const ROOT = resolve(__dirname, "../../../../..");
const HERE = __dirname;
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));

async function started(page: import("@playwright/test").Page) {
  const { user, up } = await authorWithConfirmedUpload(page);
  const res = await startRunApi(page, await runBody(page, up.outline_version_id, { kind: "rows", rows: [8, 9, 25] }), uniqueKey());
  expect(res.status(), await res.text()).toBe(201);
  return { user, up, runText: await res.text() };
}

test("GR-13: staff only; every role reads the prompt list; responses never mention students or teachers", async ({ page }) => {
  const { runText } = await started(page);
  expect(runText).not.toMatch(/student|teacher/i);
  const roles = (await db().query<{ role: string }>("select distinct role from app_user")).map((r) => r.role);
  for (const r of roles) expect(["author", "reviewer", "approver"]).toContain(r);
  for (const role of ["author", "reviewer", "approver"] as const satisfies Role[]) {
    await page.context().clearCookies();
    await signInAs(page, role);
    const res = await page.request.get("/api/prompt-versions");
    expect(res.status()).toBe(200);
    const v = (await res.json()) as { current_prompt_version_id: string; guidance_versions: unknown[] };
    // the locked layer is Newsela's own prompt text (it may name teachers by design); the screen's data fields must not
    expect(JSON.stringify({ id: v.current_prompt_version_id, g: v.guidance_versions })).not.toMatch(/student|teacher/i);
  }
});

test("CON-G8: no minutes, review time or duration key in the Run or prompt-list bodies", async ({ page }) => {
  const { runText } = await started(page);
  const pv = await (await page.request.get("/api/prompt-versions")).text();
  const keys = (t: string) => Object.keys(JSON.parse(t) as object);
  const walkKeys = (o: unknown): string[] => (o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => [k, ...walkKeys(v)]) : []);
  for (const t of [runText, pv]) {
    expect(keys(t).length).toBeGreaterThan(0);
    expect(walkKeys(JSON.parse(t)).filter((k) => /minutes|review_time|duration/i.test(k))).toEqual([]);
  }
});

test("SCR-21: /prompt-guidance lists guidance versions and the read-only locked layer", async ({ page }) => {
  await signInAs(page, "author");
  const res = await page.request.get("/api/prompt-versions");
  expect(res.status()).toBe(200);
  const pv = (await res.json()) as { locked_layer: { text: string }; guidance_versions: unknown[] };
  expect(pv.guidance_versions.length).toBeGreaterThan(0);
  const h1 = (p: import("@playwright/test").Page) => p.getByRole("heading", { level: 1, name: "Prompt guidance" });
  const rows = (p: import("@playwright/test").Page) => p.getByRole("list", { name: "Guidance versions" }).getByRole("listitem");

  await page.goto("/prompt-guidance");
  await expect(h1(page)).toBeVisible();
  const locked = page.locator("section[aria-labelledby='pg-locked']");
  await expect(locked.getByRole("heading", { name: "Locked rules (read-only)" })).toBeVisible();
  await expect(locked.locator("pre")).toContainText(pv.locked_layer.text.slice(0, 40).replace(/\s+/g, " ").trim());
  await expect(locked.getByRole("textbox")).toHaveCount(0);
  await expect(locked.getByRole("button")).toHaveCount(0);
  await expect(rows(page)).toHaveCount(pv.guidance_versions.length);
  await expect(rows(page).last()).toContainText("v1");

  // a reviewer sees the same lists but no editor
  await page.context().clearCookies();
  await signInAs(page, "reviewer");
  await page.goto("/prompt-guidance");
  await expect(h1(page)).toBeVisible();
  await expect(locked.getByRole("heading", { name: "Locked rules (read-only)" })).toBeVisible();
  await expect(rows(page)).toHaveCount(pv.guidance_versions.length);
  await expect(page.getByLabel("Guidance text")).toHaveCount(0);
  await expect(page.getByText("Only authors edit guidance.")).toBeVisible();
});

test("R-54: no session is 401 UNAUTHENTICATED; a reviewer start is 403", async ({ page, playwright }) => {
  const { up } = await authorWithConfirmedUpload(page);
  const body = await runBody(page, up.outline_version_id, { kind: "all" });
  const anon = await playwright.request.newContext({ baseURL: getStack().baseURL, extraHTTPHeaders: { Origin: getStack().baseURL } });
  const post = await anon.post("/api/runs", { data: body });
  expect(post.status()).toBe(401);
  expect(((await post.json()) as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
  const get = await anon.get("/api/prompt-versions");
  expect(get.status()).toBe(401);
  expect(((await get.json()) as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
  await anon.dispose();
  await page.context().clearCookies();
  await signInAs(page, "reviewer");
  expect((await startRunApi(page, body, uniqueKey())).status()).toBe(403);
});

test("GR-9: the restricted source folder is ignored, untracked and never referenced by these specs", async () => {
  expect(spawnSync("git", ["check-ignore", "-q", "docs/source/restricted/x"], { cwd: ROOT }).status).toBe(0);
  expect(spawnSync("git", ["ls-files", "docs/source/restricted"], { cwd: ROOT, encoding: "utf8" }).stdout.trim()).toBe("");
  const needle = ["docs", "source", "restricted"].join("/");
  for (const f of walk(HERE).filter((p) => p.endsWith(".ts") && !p.endsWith("wf-4-obligations.spec.ts"))) {
    expect(readFileSync(f, "utf8"), f).not.toContain(needle);
  }
});

test("CON-G4: run.start is audited with actor and time, and the audit log is append-only", async ({ page }) => {
  const { user } = await started(page);
  const rows = await db().query<{ id: string; actor_id: string; at: Date | null }>("select id, actor_id, at from audit_event where action='run.start' and actor_id=$1", [user.user_id]);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.at).not.toBeNull();
  await expect(db().query("update audit_event set action='x' where id=$1", [rows[0]!.id])).rejects.toThrow();
  await expect(db().query("delete from audit_event where id=$1", [rows[0]!.id])).rejects.toThrow();
  expect(await db().count("audit_event", "id=$1", [rows[0]!.id])).toBe(1);
});

test("OBS-7: audit rows, run rows and the web log hold no key, password hash, session cookie or restricted text", async ({ page }) => {
  const { user } = await started(page);
  const cookies = (await page.context().cookies()).map((c) => c.value).filter((v) => v.length > 16);
  const rows = JSON.stringify(await db().query("select * from audit_event where actor_id=$1", [user.user_id])) + JSON.stringify(await db().query("select * from run where started_by=$1", [user.user_id]));
  const logs = getStack().logs().join("\n");
  const forbidden = [/sk-[A-Za-z0-9]/, /ANTHROPIC/, /password_hash/, new RegExp(["docs", "source", "restricted"].join("/"))];
  for (const [name, text] of [["rows", rows], ["logs", logs]] as const) {
    for (const re of forbidden) expect(text, `${name} ${re}`).not.toMatch(re);
    for (const c of cookies) expect(text.includes(c), `${name} holds a session cookie value`).toBe(false);
  }
});

test("OBS-11: WF-4 is registered with test_start_run_capture and the spec exists", async () => {
  const doc = readFileSync(join(ROOT, "docs/design/observability.md"), "utf8");
  const line = doc.split("\n").find((l) => l.startsWith("| WF-4 |"));
  expect(line).toBeDefined();
  expect(line).toContain("test_start_run_capture");
  expect(existsSync(join(HERE, "start-run-capture.spec.ts"))).toBe(true);
});
