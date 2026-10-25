// NL-95: build the real-stack state SCR-5 specs need (seeded stack, a signed-in author, an uploaded sheet with every error confirmed).
// Column names come from packages/db/migrations/0004_runs.sql (the schema file is the truth).
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type APIResponse, type Page } from "@playwright/test";
import type { components } from "../../../src/lib/api-types";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs, type TestUser } from "../support/users";

export type ValidationReportJson = components["schemas"]["ValidationReport"];
export type RunJson = components["schemas"]["Run"];
export const FIXTURES = resolve(__dirname, "../../../../../packages/core/tests/fixtures/outline");
export const fixtureBytes = (name: "issued.xlsx" | "issued.csv"): Buffer => readFileSync(resolve(FIXTURES, name));

export interface Uploaded {
  outline_version_id: string;
  unit_key: string;
  version_number: number;
}

/** run columns: id, kind, state, scope_json, prompt_version_id, choices_json, choices_hash, cap_usd, idempotency_key, started_by.
 *  lesson_job columns: id, run_id, kind ('unit_plan' | 'lesson' | 'candidate'), lesson_id, idempotency_key, status, queued_at. */
export const ERRORS = 6;
export const COPY = {
  generate: "Generate 47 lessons",
  dialogTitle: "Start a run",
  startRun: "Start run",
  roleForbidden: "Only authors can start a run.",
  dayCap: (left: string) => `Daily spend cap reached. $${left} left today. No run can start until tomorrow.`,
  incomplete: (n: number) => `Confirm the report first: ${n} ${n === 1 ? "error" : "errors"} still to confirm.`,
  invalid: "Some of these choices aren't valid. Check the rows and the cap, then try again.",
  promptLoading: "The prompt version is still loading.",
} as const;

let seeded: Promise<void> | undefined;
export function ensureSeed(): Promise<void> {
  seeded ??= getStack().seed().then(() => undefined);
  return seeded;
}
const origin = () => ({ Origin: getStack().baseURL });

export async function uploadSheet(page: Page, name: "issued.xlsx" | "issued.csv" = "issued.xlsx"): Promise<Uploaded> {
  const mimeType = name.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv";
  const res = await page.request.post("/api/outline-versions", { multipart: { file: { name, mimeType, buffer: fixtureBytes(name) } }, headers: origin() });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as Uploaded;
}

export async function authorWithUpload(page: Page): Promise<{ user: TestUser; up: Uploaded }> {
  await ensureSeed();
  const user = await createUser("author");
  await signInAs(page, user);
  return { user, up: await uploadSheet(page) };
}

export const screenUrl = (u: Uploaded) => `/units/${u.unit_key}/outlines/${u.version_number}`;
export async function getReport(page: Page, vid: string): Promise<ValidationReportJson> {
  const res = await page.request.get(`/api/outline-versions/${vid}/report`);
  expect(res.status()).toBe(200);
  return (await res.json()) as ValidationReportJson;
}
export function postChoice(page: Page, vid: string, data: { target_id: string; kind: string; value?: string | null }) {
  return page.request.post(`/api/outline-versions/${vid}/choices`, { data, headers: origin() });
}
export async function unitConflictId(vid: string): Promise<string> {
  const rows = await db().query<{ findings_json: { kind: string; finding_id: string }[] }>(
    "select findings_json from outline_row where outline_version_id=$1 and row_number=0",
    [vid],
  );
  const f = rows[0]?.findings_json.find((x) => x.kind === "unit_conflict");
  if (!f) throw new Error("no unit_conflict finding in the meta row");
  return f.finding_id;
}
const errorIds = (r: ValidationReportJson) => r.rows.flatMap((row) => row.findings.filter((f) => f.level === "error").map((f) => f.finding_id));

/** Confirm every error through the choices API (five row errors + the unit conflict); leave `except` errors unconfirmed (row errors first). */
export async function confirmAllErrors(page: Page, vid: string, except = 0): Promise<void> {
  const ids = errorIds(await getReport(page, vid));
  const all: { target_id: string; kind: string; value?: string }[] = ids.map((target_id) => ({ target_id, kind: "confirm_fix" }));
  all.push({ target_id: await unitConflictId(vid), kind: "confirm_unit", value: "G6.U4" });
  for (const c of all.slice(0, all.length - except)) {
    const res = await postChoice(page, vid, c);
    expect(res.status(), await res.text()).toBe(200);
  }
}
/** Undo one confirmed row error through the API. */
export async function revertOne(page: Page, vid: string): Promise<void> {
  const res = await postChoice(page, vid, { target_id: errorIds(await getReport(page, vid))[0]!, kind: "revert" });
  expect(res.status(), await res.text()).toBe(200);
}
export async function authorWithConfirmedUpload(page: Page, except = 0) {
  const r = await authorWithUpload(page);
  await confirmAllErrors(page, r.up.outline_version_id, except);
  return r;
}

export function startRunApi(page: Page, body: unknown, key?: string): Promise<APIResponse> {
  return page.request.post("/api/runs", { data: body as object, headers: { ...origin(), ...(key ? { "Idempotency-Key": key } : {}) } });
}
export const uniqueKey = () => `e2e-${randomBytes(8).toString("hex")}`;
export async function currentPrompt(page: Page) {
  const res = await page.request.get("/api/prompt-versions");
  expect(res.status()).toBe(200);
  return (await res.json()) as components["schemas"]["PromptVersions"];
}
export async function runBody(page: Page, vid: string, scope: unknown, cap = 13) {
  return { outline_version_id: vid, mode: "run", scope, prompt_version_id: (await currentPrompt(page)).current_prompt_version_id, cap_usd: cap };
}
const inserted: string[] = [];
/** Insert one reserved spend row for the user today. Release it with releaseSpend() in afterEach: the project day ceiling is shared by every spec. */
export async function insertSpend(userId: string, usd: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const id = `sr_e2e_${randomBytes(6).toString("hex")}`;
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
export type Counts = Record<"run" | "lesson_job" | "spend_reservation" | "audit_event", number>;
export async function rowCounts(actorId: string): Promise<Counts> {
  const d = db();
  return {
    run: await d.count("run", "started_by=$1", [actorId]),
    lesson_job: await d.count("lesson_job", "run_id in (select id from run where started_by=$1)", [actorId]),
    spend_reservation: await d.count("spend_reservation", "user_id=$1", [actorId]),
    audit_event: await d.count("audit_event", "actor_id=$1", [actorId]),
  };
}
export async function openDialog(page: Page, up: Uploaded) {
  await page.goto(screenUrl(up));
  await page.getByRole("button", { name: COPY.generate }).click();
  const dialog = page.getByRole("dialog", { name: COPY.dialogTitle });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: COPY.startRun })).toBeEnabled();
  return dialog;
}

/** The locked layer's hash computed from the files on disk, in a tsx child (see locked-hash.ts). */
export function lockedHashOnDisk(): string {
  const root = resolve(__dirname, "../../../../..");
  const r = spawnSync("npx", ["tsx", resolve(__dirname, "locked-hash.ts")], { cwd: root, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) throw new Error(`locked-hash failed: ${r.stderr.slice(-500)}`);
  return r.stdout.trim();
}
