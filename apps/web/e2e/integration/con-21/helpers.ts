// NL-97: real-stack state for the CON-21 specs: a confirmed outline, runs started through POST /api/runs and drained by the
// scripted claim loop (drive-worker.ts), and readers pinned to the SCR-17 labels.
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import type { components } from "../../../src/lib/api-types";
import { confirmAll, ensureSeed, uploadFixture, type Uploaded } from "../con-3/helpers";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { randomBytes } from "node:crypto";
import { hash_password } from "@ls/core/auth/passwords";
import { signInAs, type Role, type TestUser } from "../support/users";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/**
 * A staff user whose display NAME is a valid `usr_<ULID>` string. Seam defect found by this join (devlog, request R-1): run start pins
 * intake choices with confirmed_by = the user's display name, while PgRunRepo.pinned_choices parses it against /^usr_[ULID]$/, so any
 * run started after real confirmations fails its unit-plan job with a ZodError. Until that is fixed, a name shaped like an id passes.
 */
export async function createUlidUser(role: Role): Promise<TestUser> {
  const bytes = randomBytes(26);
  const id = "usr_" + Array.from(bytes, (b) => CROCKFORD[b % 32]).join("");
  const hex = randomBytes(5).toString("hex");
  const user: TestUser = { user_id: id, email: `${role}.${hex}@example.test`, name: id, role, synthetic: true, password: randomBytes(12).toString("base64url") };
  await db().query("insert into app_user (id, email, name, role, synthetic, password_hash) values ($1,$2,$3,$4,$5,$6)", [user.user_id, user.email, user.name, role, true, hash_password(user.password)]);
  return user;
}

export type Summary = components["schemas"]["RunSummary"] & { trace_incomplete?: boolean };
export { ensureSeed };
export type Scenario = "mixed" | "repaired" | "truncation-then-ok" | "lost-call" | "fails";
const ROWS: Record<Scenario, number[]> = { mixed: [8, 9, 25], repaired: [8], "truncation-then-ok": [9], "lost-call": [8], fails: [25] };

export const summaryApi = (runId: string) => `/api/runs/${runId}/summary`;
export const summaryUrl = (runId: string, unitKey = "g6-u4") => `/units/${unitKey}/runs/${runId}/summary`;

let outline: Uploaded | undefined;
/** One confirmed outline version for the whole file; the author who uploaded it is the one signed in on `page`. */
export async function authorSession(page: Page): Promise<{ user: TestUser; up: Uploaded }> {
  await ensureSeed();
  const user = await createUlidUser("author");
  await signInAs(page, user);
  if (!outline) {
    const up = await uploadFixture(page);
    await confirmAll(page, up);
    outline = up;
  }
  return { user, up: outline };
}

export async function unitKeyOf(up: Uploaded): Promise<string> {
  return up.unit_key;
}

function drive(scenario: Scenario, runId: string): Promise<void> {
  return new Promise((ok, fail) => {
    const cwd = resolve(__dirname, "../../..");
    const child = spawn("npx", ["tsx", "e2e/integration/con-21/drive-worker.ts", scenario, runId], {
      cwd, env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: getStack().databaseUrl } as unknown as NodeJS.ProcessEnv,
    });
    mkdirSync(resolve(cwd, "test-results"), { recursive: true });
    let err = "";
    child.stdout.on("data", () => undefined);
    child.stderr.on("data", (d: Buffer) => {
      err += d.toString();
      appendFileSync(resolve(cwd, "test-results", "con-21-driver.log"), d);
    });
    child.on("exit", (code) => (code === 0 ? ok() : fail(new Error(`drive-worker ${scenario} exited ${code}: ${err.slice(-1500)}`))));
  });
}

/** Starts a run through the real route as the signed-in author. With `drain: false` the run is left queued (in progress). */
export async function startRun(page: Page, up: Uploaded, scenario: Scenario, opts: { drain?: boolean } = {}): Promise<string> {
  const [pv] = await db().query<{ id: string }>("select id from prompt_version order by id limit 1");
  const res = await page.request.post("/api/runs", {
    data: { outline_version_id: up.outline_version_id, mode: "run", scope: { kind: "rows", rows: ROWS[scenario] }, prompt_version_id: pv!.id, cap_usd: 13 },
    headers: { Origin: getStack().baseURL },
  });
  expect(res.status(), await res.text()).toBe(201);
  const { run_id } = (await res.json()) as { run_id: string };
  if (opts.drain !== false) await drive(scenario, run_id);
  return run_id;
}

export async function runScenario(page: Page, scenario: Scenario): Promise<{ user: TestUser; up: Uploaded; runId: string }> {
  const { user, up } = await authorSession(page);
  return { user, up, runId: await startRun(page, up, scenario) };
}

export async function getSummary(page: Page, runId: string): Promise<Summary> {
  const res = await page.request.get(summaryApi(runId));
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as Summary;
}

export async function asRole(page: Page, role: Role): Promise<TestUser> {
  await page.context().clearCookies();
  return signInAs(page, role === "author" ? await createUlidUser("author") : role);
}

/** Screen readers: label (text of a <dt>) to the text of the <dd> that follows, scoped to the summary page. */
export async function screenFigures(page: Page): Promise<Record<string, string>> {
  await expect(page.getByRole("heading", { name: "Run summary" })).toBeVisible();
  await expect(page.getByLabel("Run figures")).toBeVisible();
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const dt of Array.from(document.querySelectorAll("main dt"))) {
      const dds: string[] = [];
      for (let e = dt.nextElementSibling; e && e.tagName === "DD"; e = e.nextElementSibling) dds.push((e.textContent ?? "").trim());
      out[(dt.textContent ?? "").trim()] = dds.join(" | ");
    }
    return out;
  });
}

export async function failuresOnScreen(page: Page): Promise<{ reason: string; count: number }[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("main table tbody tr"))
      .map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent ?? "").trim()))
      .filter((c) => c.length === 2)
      .map((c) => ({ reason: c[0]!, count: Number(c[1]) })),
  );
}

export interface Completeness { run_id: string; terminal_jobs_without_calls: string[]; summary_matches_calls: boolean }
/** The finalizer's completeness check on the finished run, with one completed call row removed and then restored (drive-worker.ts). */
export function probeCompleteness(runId: string): Promise<{ before: Completeness; removed: Completeness; restored: Completeness }> {
  return new Promise((ok, fail) => {
    const cwd = resolve(__dirname, "../../..");
    const child = spawn("npx", ["tsx", "e2e/integration/con-21/drive-worker.ts", "completeness", runId], {
      cwd, env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: getStack().databaseUrl } as unknown as NodeJS.ProcessEnv,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("exit", (code) => {
      try {
        ok(JSON.parse(out.trim().split("\n").pop() as string));
      } catch {
        fail(new Error(`completeness probe exited ${code}: ${(err || out).slice(-1500)}`));
      }
    });
  });
}

/** Runs shared by the axe and visual specs of one file (one drained mixed run, one drained clean run, one queued run). */
const memo = new Map<string, string>();
export async function sharedRun(page: Page, key: "mixed" | "repaired" | "queued"): Promise<{ up: Uploaded; runId: string }> {
  const { up } = await authorSession(page);
  let id = memo.get(key);
  if (!id) {
    id = await startRun(page, up, key === "mixed" ? "mixed" : "repaired", { drain: key !== "queued" });
    memo.set(key, id);
  }
  return { up, runId: id };
}
