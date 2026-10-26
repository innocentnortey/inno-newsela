// NL-103 helpers: author sessions, the one WP-1 lesson (G6.U4.L4) seeded through the real run route, the worker driver (driver24.ts),
// api wrappers and the row counters the specs read. Ids only are ever printed. Flow copied from con-5/helpers.ts (another slice's file).
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type APIResponse, type Page } from "@playwright/test";
import type { components } from "../../../src/lib/api-types";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { hash_password } from "@ls/core/auth/passwords";
import { createUser, signInAs, type TestUser } from "../support/users";

export type PromptVersions = components["schemas"]["PromptVersions"];
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- response bodies are probed field by field in specs
export type Json = Record<string, any>;
export const LESSON = "G6.U4.L4";
export const UNIT_KEY = "g6-u4";
export const PG_PATH = "/prompt-guidance";
export const SHOTS = "e2e/__screenshots__/integration/con-24";
const CWD = resolve(__dirname, "../../..");
const FIXTURES = resolve(__dirname, "../../../../../packages/core/tests/fixtures/outline");

export const origin = () => ({ Origin: getStack().baseURL });
export const hex = (n = 4) => randomBytes(n).toString("hex");
/** A unique marker for a case: guidance text carrying it is found exactly in rendered prompts. */
export const marker = (c: string) => `NL103-${c}-${hex()}`;

// ---- driver ----
export function driver(args: string[]): Promise<{ finished: boolean }> {
  return new Promise((ok, fail) => {
    const child = spawn("npx", ["tsx", "e2e/integration/con-24/driver24.ts", ...args], {
      cwd: CWD,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: getStack().databaseUrl } as unknown as NodeJS.ProcessEnv,
    });
    mkdirSync(resolve(CWD, "test-results"), { recursive: true });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => {
      err += d.toString();
      appendFileSync(resolve(CWD, "test-results", "con-24-driver.log"), d);
    });
    child.on("exit", (code) => {
      if (code !== 0) return fail(new Error(`driver24 ${args.join(" ")} exited ${code}: ${err.slice(-1500)}`));
      ok(JSON.parse(out.trim().split("\n").pop() as string) as { finished: boolean });
    });
  });
}
/** Starts a driver without awaiting it; the caller awaits the returned promise later. */
export function driverBg(args: string[]): Promise<{ finished: boolean }> {
  const p = driver(args);
  p.catch(() => undefined);
  return p;
}

// ---- fixtures: seed, upload, author ----
export interface Uploaded { outline_version_id: string; unit_key: string; version_number: number }
let seeded: Promise<void> | undefined;
export function ensureSeed(): Promise<void> {
  seeded ??= getStack().seed().then(() => undefined);
  return seeded;
}
async function uploadSheet(page: Page): Promise<Uploaded> {
  const buffer = readFileSync(resolve(FIXTURES, "issued.xlsx"));
  const res = await page.request.post("/api/outline-versions", {
    multipart: { file: { name: "issued.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer } },
    headers: origin(),
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as Uploaded;
}
async function confirmAllErrors(page: Page, vid: string): Promise<void> {
  const rep = await page.request.get(`/api/outline-versions/${vid}/report`);
  expect(rep.status()).toBe(200);
  const report = (await rep.json()) as components["schemas"]["ValidationReport"];
  const ids = report.rows.flatMap((row) => row.findings.filter((f) => f.level === "error").map((f) => f.finding_id));
  const [meta] = await db().query<{ findings_json: { kind: string; finding_id: string }[] }>(
    "select findings_json from outline_row where outline_version_id=$1 and row_number=0",
    [vid],
  );
  const conflict = meta?.findings_json.find((x) => x.kind === "unit_conflict");
  if (!conflict) throw new Error("no unit_conflict finding in the meta row");
  const all: { target_id: string; kind: string; value?: string }[] = ids.map((target_id) => ({ target_id, kind: "confirm_fix" }));
  all.push({ target_id: conflict.finding_id, kind: "confirm_unit", value: "G6.U4" });
  for (const data of all) {
    const res = await page.request.post(`/api/outline-versions/${vid}/choices`, { data, headers: origin() });
    expect(res.status(), await res.text()).toBe(200);
  }
}
let outline: Uploaded | undefined;
/** The suite's one confirmed outline (uploaded once per stack, found again by SQL if the worker process restarted). */
async function outlineFor(page: Page): Promise<Uploaded> {
  if (outline) return outline;
  const [have] = await db().query<{ id: string; number: number }>("select id, number from outline_version order by created_at desc limit 1");
  if (have) return (outline = { outline_version_id: have.id, unit_key: UNIT_KEY, version_number: have.number });
  const up = await uploadSheet(page);
  await confirmAllErrors(page, up.outline_version_id);
  return (outline = up);
}
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/**
 * A staff author whose display NAME is a valid `usr_<ULID>` string (copied from con-21/helpers.ts). Seam defect (request R-1 in the
 * devlog): run start pins confirmed_by with the display name while PgRunRepo.pinned_choices parses it as /^usr_[ULID]$/, so a run
 * started by an author with any other name fails its unit-plan job with a ZodError.
 */
export async function createAuthor(): Promise<TestUser> {
  const id = "usr_" + Array.from(randomBytes(26), (b) => CROCKFORD[b % 32]).join("");
  const user: TestUser = { user_id: id, email: `author.${hex(5)}@example.test`, name: id, role: "author", synthetic: true, password: randomBytes(12).toString("base64url") };
  await db().query("insert into app_user (id, email, name, role, synthetic, password_hash) values ($1,$2,$3,$4,$5,$6)", [user.user_id, user.email, user.name, "author", true, hash_password(user.password)]);
  return user;
}
export async function authorSession(page: Page): Promise<{ user: TestUser; up: Uploaded }> {
  await ensureSeed();
  const user = await createAuthor();
  await signInAs(page, user);
  return { user, up: await outlineFor(page) };
}
export async function roleSession(page: Page, role: "reviewer" | "approver"): Promise<TestUser> {
  await ensureSeed();
  const user = await createUser(role);
  await signInAs(page, user);
  return user;
}

// ---- api wrappers ----
export async function getPrompts(page: Page): Promise<PromptVersions> {
  const res = await page.request.get("/api/prompt-versions");
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as PromptVersions;
}
export const currentNumber = (p: PromptVersions) => p.guidance_versions.find((v) => v.version_id === p.current_prompt_version_id)!.number;
export function saveApi(page: Page, body: unknown): Promise<APIResponse> {
  return page.request.post("/api/prompt-versions", { data: body as object, headers: origin() });
}
export const uniqueKey = () => `e2e-${hex(8)}`;
export function startRunApi(page: Page, body: unknown): Promise<APIResponse> {
  return page.request.post("/api/runs", { data: body as object, headers: { ...origin(), "Idempotency-Key": uniqueKey() } });
}
export async function startRun(page: Page, body: unknown): Promise<string> {
  const res = await startRunApi(page, body);
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { run_id: string }).run_id;
}
export async function genBody(page: Page, up: Uploaded, cap = 13) {
  return { outline_version_id: up.outline_version_id, mode: "run", scope: { kind: "rows", rows: [8] }, prompt_version_id: (await getPrompts(page)).current_prompt_version_id, cap_usd: cap };
}
export async function trialBody(page: Page, up: Uploaded, cap = 1) {
  return { outline_version_id: up.outline_version_id, mode: "trial", scope: { kind: "rows", rows: [4] }, lesson_id: LESSON, prompt_version_id: (await getPrompts(page)).current_prompt_version_id, cap_usd: cap };
}
export async function errorOf(res: APIResponse): Promise<{ code: string; message: string; details: Json }> {
  return ((await res.json()) as { error: { code: string; message: string; details: Json } }).error;
}

// ---- the lesson under test ----
export async function lessonRow() {
  const [r] = await db().query<{ state: string; current_version_id: string | null }>("select state, current_version_id from lesson where id=$1", [LESSON]);
  return r;
}
export async function ensureL4(page: Page): Promise<Uploaded> {
  const { up } = await authorSession(page);
  const have = await lessonRow();
  if (have?.current_version_id) return up;
  const run_id = await startRun(page, await genBody(page, up));
  await driver(["parent", run_id]);
  const row = await lessonRow();
  expect(row?.state, "the parent run must leave G6.U4.L4 as a generated draft").toBe("draft");
  expect(row?.current_version_id).toBeTruthy();
  return up;
}

// ---- counters and evidence ----
export const pvCount = () => db().count("prompt_version");
export const auditCount = (action: string) => db().count("audit_event", "action=$1", [action]);
export async function pvRow(id: string) {
  const [r] = await db().query<{ id: string; number: number; author_id: string; reason: string; diff: string; guidance_text: string; locked_hash: string; created_at: Date }>(
    "select id, number, author_id, reason, diff, guidance_text, locked_hash, created_at from prompt_version where id=$1",
    [id],
  );
  return r!;
}
export function calls(runId: string) {
  return db().query<{ id: string; purpose: string; rendered_prompt: string; raw_output: string | null; status: string; cost_usd: string; served_model: string | null; reservation_id: string | null }>(
    "select id, purpose, rendered_prompt, raw_output, status, cost_usd, served_model, reservation_id from model_call where run_id=$1 order by sent_at",
    [runId],
  );
}
export async function runPin(runId: string): Promise<string> {
  return (await db().query<{ prompt_version_id: string }>("select prompt_version_id from run where id=$1", [runId]))[0]!.prompt_version_id;
}
/** The text of the locked section of a rendered prompt: between "### locked\n" and the next "\n\n### guidance". */
export function lockedSection(prompt: string): string {
  const a = prompt.indexOf("### locked\n");
  const b = prompt.indexOf("\n\n### guidance");
  expect(a, "### locked present").toBeGreaterThanOrEqual(0);
  expect(b, "### guidance present").toBeGreaterThan(a);
  return prompt.slice(a + "### locked\n".length, b);
}
export function lockedHashOnDisk(): string {
  const root = resolve(__dirname, "../../../../..");
  const r = spawnSync("npx", ["tsx", resolve(__dirname, "locked-hash.ts")], { cwd: root, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) throw new Error(`locked-hash failed: ${r.stderr.slice(-500)}`);
  return r.stdout.trim();
}

// ---- spend rows (copied from con-5/helpers.ts) ----
const inserted: string[] = [];
/** Insert one reserved spend row for the user today. Release it with releaseSpend() in afterEach: the day ceiling is shared by every spec. */
export async function insertSpend(userId: string, usd: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const id = `sr_e2e_${hex(6)}`;
  inserted.push(id);
  await db().query(
    "insert into spend_reservation (id, run_id, job_id, user_id, purpose, reserved_usd, status, day) values ($1,null,null,$2,'lesson',$3,'reserved',$4)",
    [id, userId, usd, day],
  );
}
export async function releaseSpend(): Promise<void> {
  const ids = inserted.splice(0);
  if (ids.length) await db().query("delete from spend_reservation where id = any($1)", [ids]);
}

// ---- SCR-21 page actions ----
export async function openGuidance(page: Page): Promise<void> {
  await page.goto(PG_PATH);
  await expect(page.getByRole("heading", { name: "Prompt guidance", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Guidance text")).toBeVisible();
}
export async function saveViaUi(page: Page, text: string, reason: string): Promise<void> {
  await page.getByLabel("Guidance text").fill(text);
  await page.getByLabel("Reason").fill(reason);
  await page.getByRole("button", { name: "Save as new version" }).click();
}
