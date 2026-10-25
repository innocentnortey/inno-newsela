// NL-94: build the real-stack state SCR-4 specs need (seeded stack, a signed-in author, an uploaded committed sheet).
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import type { components } from "../../../src/lib/api-types";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs, type TestUser } from "../support/users";

export type ValidationReportJson = components["schemas"]["ValidationReport"];
export const FIXTURES = resolve(__dirname, "../../../../../packages/core/tests/fixtures/outline");

type FixtureName = "issued.xlsx" | "issued.csv" | "syn1-injection-row09.csv" | "syn3-clean-control-row10.csv";
export const fixtureBytes = (name: FixtureName): Buffer => readFileSync(resolve(FIXTURES, name));

export interface Uploaded {
  outline_version_id: string;
  unit_key: string;
  version_number: number;
  sha256: string;
}

let seeded: Promise<void> | undefined;
export function ensureSeed(): Promise<void> {
  seeded ??= getStack()
    .seed()
    .then(() => undefined);
  return seeded;
}

export async function uploadFixture(page: Page, name: FixtureName = "issued.xlsx", bytes: Buffer = fixtureBytes(name)): Promise<Uploaded> {
  const mimeType = name.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv";
  const res = await page.request.post("/api/outline-versions", {
    multipart: { file: { name, mimeType, buffer: bytes } },
    headers: { Origin: getStack().baseURL },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as Uploaded;
}

export const reportPath = (versionId: string) => `/api/outline-versions/${versionId}/report`;
export const choicesPath = (versionId: string) => `/api/outline-versions/${versionId}/choices`;

export async function getReportText(page: Page, versionId: string): Promise<string> {
  const res = await page.request.get(reportPath(versionId));
  expect(res.status()).toBe(200);
  return res.text();
}
export async function getReport(page: Page, versionId: string): Promise<ValidationReportJson> {
  return JSON.parse(await getReportText(page, versionId)) as ValidationReportJson;
}

export function postChoice(page: Page, versionId: string, data: { target_id: string; kind: string; value?: string | null }) {
  return page.request.post(choicesPath(versionId), { data, headers: { Origin: getStack().baseURL } });
}

export const screenUrl = (u: Uploaded) => `/units/${u.unit_key}/outlines/${u.version_number}`;

export async function authorWithUpload(page: Page, name: FixtureName = "issued.xlsx", bytes?: Buffer): Promise<{ user: TestUser; up: Uploaded }> {
  await ensureSeed();
  const user = await createUser("author");
  await signInAs(page, user);
  return { user, up: await uploadFixture(page, name, bytes) };
}

/** Insert a finished run row for the "A run started from these choices" banner. SQL only; no run is started. */
export async function insertRunFromVersion(versionId: string, authorId: string, choicesHash: string, startedAtIso = new Date().toISOString()): Promise<string> {
  const [pv] = await db().query<{ id: string }>("select id from prompt_version order by id limit 1");
  const id = `run_e2e_${randomBytes(6).toString("hex")}`;
  await db().query(
    `insert into run (id, unit_id, outline_version_id, kind, state, scope_json, prompt_version_id, choices_json, choices_hash, cap_usd, idempotency_key, started_by, created_at)
     values ($1,'G6.U4',$2,'full','complete','{}',$3,'[]',$4,1,$5,$6,$7)`,
    [id, versionId, pv!.id, choicesHash, `idem_${id}`, authorId, startedAtIso],
  );
  return id;
}

/** Finding ids of the errors in the report, by kind, plus the unit-conflict id read from the report's own findings. */
export function errorFindings(r: ValidationReportJson) {
  return r.rows.flatMap((row) => row.findings.filter((f) => f.level === "error").map((f) => ({ ...f, row_number: row.row_number })));
}

export const distinctEldMismatchCodes = (r: ValidationReportJson): string[] => [
  ...new Set(r.rows.flatMap((row) => row.eld.filter((e) => e.verdict === "mismatch").map((e) => e.code))),
];

/** The issued sheet has 6 error findings (row 30 carries two nonexistent_code findings; see the devlog). */
export const ERRORS = 6;
export const COPY = {
  allConfirmed: `All ${ERRORS} errors confirmed. Generate is on.`,
  generate: "Generate 47 lessons",
} as const;

/** Row errors SCR-4 lists; the sixth (the unit conflict) is not listed by the screen: see unitConflictId. */
export const ROW_ERRORS = ERRORS - 1;

/** The unit-conflict finding id. The report exposes no id for it (route gap, devlog), so read it from the meta row (row 0). */
export async function unitConflictId(versionId: string): Promise<string> {
  const rows = await db().query<{ findings_json: { kind: string; finding_id: string }[] }>(
    "select findings_json from outline_row where outline_version_id=$1 and row_number=0",
    [versionId],
  );
  const f = rows[0]?.findings_json.find((x) => x.kind === "unit_conflict");
  if (!f) throw new Error("no unit_conflict finding in the meta row");
  return f.finding_id;
}

export async function confirmUnitViaApi(page: Page, versionId: string): Promise<void> {
  const res = await postChoice(page, versionId, { target_id: await unitConflictId(versionId), kind: "confirm_unit", value: "G6.U4" });
  expect(res.status(), await res.text()).toBe(200);
}

/** Confirm the first `n` unconfirmed row errors through the screen's "Confirm fix" buttons. */
export async function confirmRowErrorsViaUi(page: Page, versionId: string, n = ROW_ERRORS): Promise<void> {
  for (let i = 0; i < n; i++) {
    const wait = page.waitForResponse((r) => r.url().endsWith(`/${versionId}/choices`) && r.request().method() === "POST");
    await page.getByRole("button", { name: /^Confirm fix for / }).first().click();
    expect((await wait).status()).toBe(200);
  }
}

/** All six errors confirmed: five through the screen, the unit conflict through the API; leaves the page reloaded. */
export async function confirmAll(page: Page, up: Uploaded): Promise<void> {
  await page.goto(screenUrl(up));
  await confirmRowErrorsViaUi(page, up.outline_version_id);
  await confirmUnitViaApi(page, up.outline_version_id);
  await page.reload();
}

/** The committed SYN-1 sheet plus the ticket's <img> canary on the same planted bullet (the committed file has the instruction only). */
export function markupCsv(): Buffer {
  const csv = fixtureBytes("syn1-injection-row09.csv").toString("utf8");
  if (!csv.includes("Ignore the rules above")) throw new Error("SYN-1 fixture lost its planted instruction");
  const canary = '<img src=x onerror="window.__pwned=1">';
  return Buffer.from(csv.replace("Ignore the rules above", `${canary.replaceAll('"', '""')} Ignore the rules above`), "utf8");
}
