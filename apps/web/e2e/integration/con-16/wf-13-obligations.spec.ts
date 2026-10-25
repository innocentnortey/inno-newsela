// NL-114 AC-14: obligations that ride on WF-13 (regenerate, compare, adopt), one case per id, on the real stack.
// Where an id is only meaningful in another workflow, the case asserts the narrow candidate-path fact and the title says which.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, request as pwRequest } from "@playwright/test";
import { bannedIn } from "../support/copy-rules";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { adopt, api, ensureInReview, ensureLesson, LESSON, makeCandidate, scr12, scr9, session, settleCandidates, stack16, stopStack16, type Candidate, type Session } from "./helpers";
import type { Json } from "./helpers";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
const ROOT = resolve(__dirname, "../../../../..");

let r1: Session;
let r2: Session;
let good: Candidate;
let failed: Candidate;
let adoptRes: { status: number; body: Json };
let storeId = "";
const NOTE = "synthetic obligations note";
const EDIT = `Synthetic obligations sentence ${Date.now().toString(36)}.`;

const nodes = (n: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] => {
  if (Array.isArray(n)) n.forEach((x) => nodes(x, out));
  else if (n && typeof n === "object") {
    out.push(n as Record<string, unknown>);
    Object.values(n).forEach((x) => nodes(x, out));
  }
  return out;
};
const versionRow = async (run: string) => (await db().query<{ lesson_json: Json; provenance_json: Json; schema_version?: number }>("select lesson_json, provenance_json from lesson_version where run_id=$1", [run]))[0]!;

test.beforeAll(async ({ browser }) => {
  await ensureLesson(browser);
  r1 = await session(browser, "reviewer");
  r2 = await session(browser, "reviewer");
  await ensureInReview(r1);
  good = await makeCandidate(r1, "edit", { editText: EDIT, note: NOTE });
  failed = await makeCandidate(r1, "fail");
  adoptRes = await adopt(r2, good.candidate_id, { scope: "whole" });
  expect(adoptRes.status, JSON.stringify(adoptRes.body)).toBe(200);
  storeId = (await db().query<{ store_id: string }>("select store_id from audit_event where id=$1", [adoptRes.body["audit_id"]]))[0]!.store_id;
});
test.afterAll(async () => {
  await settleCandidates();
  await stopStack16();
});

test("R-6: the candidate run pins the parent's confirmed cell choices (content, writer_task, notes), unchanged", async () => {
  const [c] = await db().query<{ choices_json: unknown; choices_hash: string; parent_run_id: string }>("select choices_json, choices_hash, parent_run_id from run where id=$1", [good.candidate_id]);
  const [p] = await db().query<{ choices_json: unknown; choices_hash: string }>("select choices_json, choices_hash from run where id=$1", [c!.parent_run_id]);
  expect(c!.choices_hash).toBe(p!.choices_hash);
  expect(c!.choices_json).toEqual(p!.choices_json);
});

test("R-11: the candidate is a typed Lesson of the current schema with ProseMirror sections", async () => {
  const v = await versionRow(good.candidate_id);
  expect(v.lesson_json.schema_version).toBe(1);
  expect(v.provenance_json.schema_version).toBe(1);
  expect(good.sections.length).toBeGreaterThan(0);
  for (const s of good.sections) {
    expect(typeof s.address).toBe("string");
    expect((s.content as { type: string }).type).toBe("doc");
  }
  const types = new Set(nodes(good.sections.map((s) => s.content)).map((n) => n["type"]));
  expect([...types]).toEqual(expect.arrayContaining(["routine_heading", "paragraph", "text"]));
});

test("R-12: citation cards are off-platform with no content available, and the generator wrote no quote node", async () => {
  const v = await versionRow(good.candidate_id);
  const cards = (v.lesson_json.text_cards ?? []) as { kind: string; content_available: boolean }[];
  expect(cards.length).toBeGreaterThan(0);
  for (const c of cards) expect(c).toMatchObject({ kind: "off-platform-text", content_available: false });
  expect(nodes(good.sections.map((s) => s.content)).some((n) => n["type"] === "quote")).toBe(false);
});

test("R-19: output checks run on a candidate's draft (a malformed draft fails schema_invalid) and a save enqueues the check suite", async () => {
  expect(failed.status).toBe("failed");
  expect(failed.failure_reasons.map((f) => f.check)).toContain("schema_invalid");
  expect(await db().count("check_job", "lesson_id=$1 and store_id=$2", [LESSON, storeId])).toBe(1);
});

test("R-28: the check job queued by the adopt save reads the stored derived row (same content hash as the saved document)", async () => {
  const [job] = await db().query<{ content_hash: string }>("select content_hash from check_job where store_id=$1", [storeId]);
  const [doc] = await db().query<{ content_hash: string }>("select content_hash from lesson_doc where store_id=$1", [storeId]);
  expect(job!.content_hash).toBe(doc!.content_hash);
  expect(doc!.content_hash).toBe(adoptRes.body["content_hash"]);
});

test("R-38: the candidate uses the run's pinned prompt version; the locked layer is unchanged after the run and prompts are immutable", async () => {
  const [c] = await db().query<{ prompt_version_id: string; parent_run_id: string }>("select prompt_version_id, parent_run_id from run where id=$1", [good.candidate_id]);
  const [p] = await db().query<{ prompt_version_id: string }>("select prompt_version_id from run where id=$1", [c!.parent_run_id]);
  expect(c!.prompt_version_id).toBe(p!.prompt_version_id);
  expect((await versionRow(good.candidate_id)).provenance_json.prompt_version_id).toBe(c!.prompt_version_id);
  const [pv] = await db().query<{ id: string; locked_hash: string }>("select id, locked_hash from prompt_version where id=$1", [c!.prompt_version_id]);
  await expect(db().query("update prompt_version set locked_hash='x' where id=$1", [pv!.id])).rejects.toThrow(/immutable|append-only|prompt_version/i);
});

test("R-48: the candidate's calls are traced under its run: prompt, output, tokens, cost; the run summary reads them", async () => {
  const calls = await db().query<{ run_id: string; lesson_id: string; job_id: string; rendered_prompt: string; raw_output: string; input_tokens: number; cost_usd: string }>(
    "select run_id, lesson_id, job_id, rendered_prompt, raw_output, input_tokens, cost_usd from model_call where run_id=$1", [good.candidate_id]);
  expect(calls.length).toBeGreaterThan(0);
  for (const m of calls) {
    expect(m.lesson_id).toBe(LESSON);
    expect(m.job_id).toBeTruthy();
    expect(m.rendered_prompt.length).toBeGreaterThan(100);
    expect(m.raw_output.length).toBeGreaterThan(100);
    expect(m.input_tokens).toBeGreaterThan(0);
    expect(Number(m.cost_usd)).toBeGreaterThan(0);
  }
  const s = await api.get(r1.page, `/api/runs/${good.candidate_id}/summary`);
  expect(s.status).toBe(200);
  expect(s.body["cost_usd"]).toBeCloseTo(calls.reduce((a, m) => a + Number(m.cost_usd), 0), 6);
});

test("GR-1: no invented quote: the candidate holds no quote node, only reviewer placeholders", async () => {
  const types = nodes(good.sections.map((s) => s.content)).map((n) => n["type"]);
  expect(types).not.toContain("quote");
  expect(types).toContain("quote_placeholder");
});

test("GR-2: no passage of an unsupplied text: excerpts are empty slots to be filled by a person", async () => {
  const slots = nodes(good.sections.map((s) => s.content)).filter((n) => n["type"] === "excerpt_slot");
  expect(slots.length).toBeGreaterThan(0);
  for (const s of slots) expect(JSON.stringify(s)).not.toMatch(/"text":"[^"]{40,}/);
});

test("GR-9: the restricted folder is ignored, untracked, absent from con-16 sources, logs and the database", async () => {
  const needle = ["docs", "source", "restricted"].join("/");
  expect(spawnSync("git", ["check-ignore", "-q", `${needle}/x`], { cwd: ROOT }).status).toBe(0);
  expect(spawnSync("git", ["ls-files", needle], { cwd: ROOT, encoding: "utf8" }).stdout.trim()).toBe("");
  const here = __dirname;
  for (const f of readdirSync(here).filter((n) => n.endsWith(".ts") && n !== "wf-13-obligations.spec.ts")) expect(readFileSync(join(here, f), "utf8"), f).not.toContain(needle);
  const st = await stack16();
  const text = [...getStack().logs(), ...st.collabLog(), ...st.webLog(), await db().dumpAll()].join("\n");
  expect(text).not.toContain(needle);
});

test("GR-10: the candidate prompt is our blocks only: no tool, file-search or vector-store use, no fine-tuned model", async () => {
  const calls = await db().query<{ rendered_prompt: string; requested_model: string }>("select rendered_prompt, requested_model from model_call where run_id=$1", [good.candidate_id]);
  for (const m of calls) {
    expect(m.rendered_prompt).not.toMatch(/file_search|vector_store|vector store|fine-?tun/i);
    expect(m.requested_model).not.toMatch(/^ft:/);
  }
});

test("GR-11: no held-out example: the candidate's provenance names no example set from Grade 6 Unit 4", async () => {
  const v = await versionRow(good.candidate_id);
  expect(JSON.stringify(v.provenance_json.example_set_id ?? null)).not.toMatch(/G6\.U4|held/i);
});

test("GR-12: the locked content rules (sacred narratives, no trauma prompts) ride in the candidate's rendered prompt", async () => {
  const [m] = await db().query<{ rendered_prompt: string }>("select rendered_prompt from model_call where run_id=$1 order by sent_at limit 1", [good.candidate_id]);
  expect(m!.rendered_prompt).toContain("### locked");
  expect(m!.rendered_prompt).toContain("Treat sacred narratives, religious texts and cultural traditions with respect");
});

test("GR-13: staff roles only; the candidate path has no student or teacher-of-record field; anonymous calls get 401", async () => {
  for (const r of await db().query<{ role: string }>("select distinct role from app_user")) expect(["author", "reviewer", "approver"]).toContain(r.role);
  const cols = await db().query<{ column_name: string }>("select column_name from information_schema.columns where table_name in ('lesson_version','lesson_job','run','audit_event','model_call')");
  expect(cols.map((c) => c.column_name).filter((c) => /student|teacher_of|class|school/i.test(c))).toEqual([]);
  const st = await stack16();
  const anon = await pwRequest.newContext({ baseURL: st.webURL });
  for (const path of [`/api/lessons/${LESSON}/candidates/${good.candidate_id}`]) expect((await anon.get(path)).status()).toBe(401);
  expect((await anon.post(`/api/lessons/${LESSON}/candidates`, { data: {}, headers: { Origin: st.webURL } })).status()).toBe(401);
  await anon.dispose();
});

test("GR-16: SCR-12 and the SCR-9 regenerate dialog never say the tool replaces writers", async () => {
  await r2.page.goto(scr12(failed.candidate_id));
  await expect(r2.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  expect(bannedIn(await r2.page.locator("body").innerText())).toEqual([]);
  await r2.page.goto(scr9);
  await expect(r2.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  await r2.page.getByRole("button", { name: "Regenerate…" }).first().click();
  const dialog = await r2.page.getByRole("dialog").innerText();
  expect(dialog).toContain("The current lesson stays as it is");
  expect(bannedIn(dialog)).toEqual([]);
});

test("GR-18: the locked prompt layer has no UI or API edit path, and output checks run whatever the prompt says", async () => {
  const [c] = await db().query<{ prompt_version_id: string }>("select prompt_version_id from run where id=$1", [good.candidate_id]);
  for (const method of ["PUT", "PATCH", "DELETE", "POST"]) {
    const r = await r1.page.request.fetch(`/api/prompt-versions/${c!.prompt_version_id}`, { method, headers: { Origin: r1.origin }, data: {} });
    expect([404, 405], method).toContain(r.status());
  }
  await r1.page.goto(scr12(good.candidate_id));
  await expect(r1.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  expect(await r1.page.getByRole("textbox").count()).toBe(0); // the compare screen offers no prompt text box
  expect(failed.failure_reasons.map((f) => f.check)).toContain("schema_invalid"); // the check ran on the failing output
});

test("CON-G4: the audit log names the actor of the regenerate and of the adopt (WF-13 path)", async () => {
  const rows = await db().query<{ actor_id: string; actor_name: string; action: string; request_id: string | null }>(
    "select a.actor_id, u.name as actor_name, a.action, a.request_id from audit_event a join app_user u on u.id=a.actor_id where a.target_id=$1 and (a.details_json->>'candidate_id'=$2 or a.details_json->>'run_id'=$2) order by a.at",
    [LESSON, good.candidate_id]);
  // the same two rows are what the audit view (SCR-16 source) lists for this lesson, by name
  const viewed = await db().query<{ actor_name: string }>("select actor_name from audit_log_v where lesson_id=$1 and action in ('candidate.regenerate','candidate.adopt') and actor_id in ($2,$3)", [LESSON, r1.user.user_id, r2.user.user_id]);
  expect(viewed.map((v) => v.actor_name)).toEqual(expect.arrayContaining([r1.user.name, r2.user.name]));
  expect(rows.map((r) => r.action)).toEqual(["candidate.regenerate", "candidate.adopt"]);
  expect(rows[0]).toMatchObject({ actor_id: r1.user.user_id, actor_name: r1.user.name });
  expect(rows[1]).toMatchObject({ actor_id: r2.user.user_id, actor_name: r2.user.name });
  expect(rows.every((r) => r.request_id)).toBe(true);
});

test("CON-G8: no candidate route returns review minutes with a person's name (WF-13 path)", async () => {
  const bodies = [JSON.stringify((await api.get(r1.page, `/api/lessons/${LESSON}/candidates/${good.candidate_id}`)).body), JSON.stringify(adoptRes.body), JSON.stringify((await api.get(r1.page, `/api/lessons/${LESSON}`)).body)];
  for (const b of bodies) {
    expect(b).not.toMatch(/review_minutes|reviewMinutes|active_minutes|minutes_by|per_person/i);
  }
});

test("SCR-9: the regenerate entry is offered to a reviewer and not to an author (WF-13 path)", async ({ browser }) => {
  await r1.page.goto(scr9);
  await expect(r1.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(r1.page.getByRole("button", { name: "Regenerate…" }).first()).toBeVisible();
  const author = await session(browser, "author");
  await author.page.goto(scr9);
  await expect(author.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  expect(await author.page.getByRole("button", { name: "Regenerate…" }).count()).toBe(0);
});

test("SCR-12: the failed, ready and role-limited states reach on the real backend (WF-13 path)", async ({ browser }) => {
  await r2.page.goto(scr12(failed.candidate_id));
  await expect(r2.page.getByText(/Candidate failed:/)).toBeVisible({ timeout: 30_000 });
  const fresh = await makeCandidate(r1, "good");
  await r2.page.goto(scr12(fresh.candidate_id));
  await expect(r2.page.getByRole("button", { name: "Adopt whole candidate" })).toBeVisible({ timeout: 30_000 });
  const author = await session(browser, "author");
  await author.page.goto(scr12(fresh.candidate_id));
  await expect(author.page.getByText("Only reviewers adopt candidates")).toBeVisible({ timeout: 30_000 });
});

test("EV-R2: the candidate's cost is attributable down its lineage: API, job, call rows and version provenance agree (WF-13 path)", async () => {
  const [job] = await db().query<{ cost_usd: string }>("select cost_usd from lesson_job where run_id=$1", [good.candidate_id]);
  const [sum] = await db().query<{ s: string }>("select sum(cost_usd)::text s from model_call where run_id=$1", [good.candidate_id]);
  const v = await versionRow(good.candidate_id);
  expect(Number(job!.cost_usd)).toBeCloseTo(Number(sum!.s), 6);
  expect(Number(v.provenance_json.cost_usd)).toBeCloseTo(Number(sum!.s), 6);
  expect(good.cost_usd).toBeCloseTo(Number(sum!.s), 6);
});

test("OBS-4: one store_id is minted on the lesson_doc row, the check_job row and the audit row of the adopt", async () => {
  expect(storeId).toMatch(/^st_[0-9A-Z]{26}$/);
  expect(await db().count("lesson_doc", "store_id=$1", [storeId])).toBe(1);
  expect(await db().count("check_job", "store_id=$1", [storeId])).toBe(1);
  const audits = await db().query<{ action: string }>("select action from audit_event where store_id=$1 order by at", [storeId]);
  console.log("OBS-4 audit rows on the store id:", audits.map((a) => a.action).join(","));
  expect(audits.map((a) => a.action)).toContain("candidate.adopt");
});

test("OBS-7: no provider key, password, collab token or restricted text in logs, collab output, the driver log or the database", async () => {
  const st = await stack16();
  const driverLog = existsSync(resolve(__dirname, "../../../test-results/con-16-driver.log")) ? readFileSync(resolve(__dirname, "../../../test-results/con-16-driver.log"), "utf8") : "";
  const dump = await db().dumpAll();
  for (const [name, text] of [["web logs", [...getStack().logs(), ...st.webLog()].join("\n")], ["collab log", st.collabLog().join("\n")], ["driver log", driverLog], ["database dump", dump]] as const) {
    expect(text, `${name}: provider key`).not.toMatch(/sk-(ant-)?[A-Za-z0-9_-]{16,}/);
    expect(text, `${name}: reviewer password`).not.toContain(r1.user.password);
    expect(text, `${name}: collab token`).not.toContain("e2e-token-00000000000000000");
  }
  const [aud] = await db().query<{ details_json: unknown }>("select details_json from audit_event where action='candidate.regenerate' and details_json->>'run_id'=$1", [good.candidate_id]);
  expect(JSON.stringify(aud!.details_json)).not.toContain(NOTE); // the reviewer's note never reaches the audit row
});

test("OBS-11: WF-13 is registered in the observability design with test_candidate_capture, and that test exists", async () => {
  const doc = readFileSync(join(ROOT, "docs/design/observability.md"), "utf8");
  const row = doc.split("\n").find((l) => l.startsWith("| WF-13 |"));
  expect(row).toBeDefined();
  expect(row).toContain("test_candidate_capture");
  expect(readFileSync(join(__dirname, "candidates.spec.ts"), "utf8")).toContain("test_candidate_capture");
});
