// NL-114 (WF-13, CON-16): regenerate, compare and adopt on built Next + migrated Postgres + a real collaboration server + the
// worker driver on the scripted stub. Tags in titles: regenerate, spend_scope, one_in_flight, adopt, collab_down, failed_and_v1, text_not_html.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { bridgeCollab, scr12, scr9, adopt, candidateStatuses, counts, driveCandidate, driveCandidateBg, ensureFailedLesson, ensureInReview, ensureLesson, getCandidate, L5, LESSON, liveHash, makeCandidate, mkRequestId, regenerate, session, settleCandidates, stack16, stopStack16, type Candidate } from "./helpers";
import type { Json } from "./helpers";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
test.beforeAll(async ({ browser }) => {
  await ensureLesson(browser);
});
test.afterAll(stopStack16);
test.afterEach(settleCandidates);

test("test_candidate_capture: regenerate queues a candidate beside an untouched live lesson (queued, drafting, ready)", async ({ browser }) => {
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const before = await liveHash();
  const reqId = `req_e2e_capture${Date.now().toString(36)}`;
  const r = await regenerate(r1, "synthetic note", { "x-request-id": reqId });
  expect(r.status, JSON.stringify(r.body)).toBe(202);
  expect(r.body["status"]).toBe("queued");
  expect(r.body["adopted"]).toBe(false);
  expect(r.body["current_content_hash"]).toBe(before.lesson_hash);
  const id = r.body["candidate_id"] as string;

  const driver = driveCandidateBg("good", id, 5000);
  const seen = await candidateStatuses(r1, id, (c) => c.status === "ready" || c.status === "failed");
  await driver;
  console.log("candidate", id, "statuses", seen.join(" > "));
  expect(seen).toEqual(["queued", "drafting", "ready"]);

  const c = (await getCandidate(r1, id)).body;
  expect(c["version_number"]).toBe(before.versions + 1);
  expect(c["adopted"]).toBe(false);
  expect(c["current_content_hash"]).toBe(before.lesson_hash);
  const [row] = await db().query<{ adopted: boolean; kind: string; run_id: string }>("select adopted, kind, run_id from lesson_version where lesson_id=$1 and number=$2", [LESSON, before.versions + 1]);
  expect(row).toMatchObject({ adopted: false, kind: "candidate", run_id: id });
  const after = await liveHash();
  expect(after.lesson_hash).toBe(before.lesson_hash);
  expect(after.current_version_id).toBe(before.current_version_id);
  expect(after.doc_hash).toBe(before.doc_hash);

  // AC-8: model_call rows were written before the send, carry the served model; the audit row has the request id.
  const calls = await db().query<{ sent_at: string; completed_at: string | null; served_model: string | null; run_id: string; status: string }>(
    "select sent_at, completed_at, served_model, run_id, status from model_call where run_id=$1", [id]);
  expect(calls.length).toBeGreaterThan(0);
  for (const m of calls) {
    expect(m.run_id).toBe(id);
    expect(m.served_model ?? "").not.toBe("");
    expect(m.completed_at).not.toBeNull();
    expect(new Date(m.sent_at).getTime()).toBeLessThanOrEqual(new Date(m.completed_at as string).getTime());
  }
  const [aud] = await db().query<{ request_id: string; details_json: Record<string, unknown>; actor_id: string }>(
    "select request_id, details_json, actor_id from audit_event where action='candidate.regenerate' and target_id=$1 order by at desc limit 1", [LESSON]);
  expect(aud?.request_id).toBe(reqId);
  expect(aud?.actor_id).toBe(r1.user.user_id);
  expect(aud?.details_json["has_note"]).toBe(true);
  expect(JSON.stringify(aud?.details_json)).not.toContain("synthetic note");
  console.log("ids", { lesson: LESSON, candidate: id, request_id: reqId, model_calls: calls.length });
});

let v1Candidate = "";
const tagLines = (lines: string[], tag: string) => lines.filter((l) => l.includes("collab.edit_applied") && l.includes(`"tag":"${tag}"`));
const textOf = (n: unknown): string => {
  const x = n as { text?: string; content?: unknown[] };
  return (x.text ?? "") + (x.content ?? []).map(textOf).join("");
};
const sectionWith = (c: Candidate, needle: string) => c.sections.find((sec) => textOf(sec.content).includes(needle));

test("spend_scope: the candidate has its own run, cap and reservations; the parent run's spend does not move", async ({ browser }) => {
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const [parent] = await db().query<{ id: string; cap_usd: string; prompt_version_id: string }>(
    "select r.id, r.cap_usd, r.prompt_version_id from run r join lesson_job j on j.run_id=r.id where j.lesson_id=$1 and r.kind <> 'candidate' order by r.created_at desc limit 1", [LESSON]);
  const settled = async () => (await db().query<{ s: string }>("select coalesce(sum(settled_usd),0)::text s from spend_reservation where run_id=$1", [parent!.id]))[0]!.s;
  const planOf = async (run: string) => JSON.stringify(await db().query("select entries_json, lesson_links_json from unit_plan where run_id=$1", [run]));
  const [parentBefore, planBefore] = [await settled(), await planOf(parent!.id)];
  const dayBefore = Number((await db().query<{ s: string }>("select coalesce(sum(settled_usd),0)::text s from spend_reservation where user_id=$1", [r1.user.user_id]))[0]!.s);

  const c = await makeCandidate(r1);
  const id = c.candidate_id;
  const [run] = await db().query<{ kind: string; parent_run_id: string; cap_usd: string; prompt_version_id: string; started_by: string }>("select kind, parent_run_id, cap_usd, prompt_version_id, started_by from run where id=$1", [id]);
  expect(run).toMatchObject({ kind: "candidate", parent_run_id: parent!.id, prompt_version_id: parent!.prompt_version_id, started_by: r1.user.user_id });
  const [aud] = await db().query<{ details_json: { cap_usd: string } }>("select details_json from audit_event where action='candidate.regenerate' and details_json->>'run_id'=$1", [id]);
  expect(Number(run!.cap_usd)).toBe(Number(aud!.details_json.cap_usd));
  expect(Number(run!.cap_usd)).toBeGreaterThan(0);
  expect(Number(run!.cap_usd)).not.toBe(Number(parent!.cap_usd));
  const jobs = await db().query<{ kind: string; lesson_id: string; status: string }>("select kind, lesson_id, status from lesson_job where run_id=$1", [id]);
  expect(jobs).toEqual([{ kind: "candidate", lesson_id: LESSON, status: expect.any(String) }]);
  const planCand = await db().query("select lesson_links_json from unit_plan where run_id=$1", [id]);
  if (planCand.length > 0) expect(JSON.stringify(planCand)).toContain(JSON.stringify(JSON.parse(await planOf(parent!.id))[0].lesson_links_json));

  const calls = await db().query<{ run_id: string; lesson_id: string }>("select run_id, lesson_id from model_call where run_id=$1 or job_id in (select id from lesson_job where run_id=$1)", [id]);
  expect(calls.length).toBeGreaterThan(0);
  for (const m of calls) expect(m).toEqual({ run_id: id, lesson_id: LESSON });
  const resv = await db().query<{ run_id: string; user_id: string; settled_usd: string }>("select run_id, user_id, settled_usd from spend_reservation where run_id=$1", [id]);
  expect(resv.length).toBeGreaterThan(0);
  for (const x of resv) expect(x.run_id).toBe(id);
  expect(await db().count("spend_reservation", "job_id in (select id from lesson_job where run_id=$1) and run_id <> $1", [id])).toBe(0);
  expect(await settled()).toBe(parentBefore);
  expect(await planOf(parent!.id)).toBe(planBefore);
  const spent = resv.reduce((a, x) => a + Number(x.settled_usd), 0);
  const dayAfter = Number((await db().query<{ s: string }>("select coalesce(sum(settled_usd),0)::text s from spend_reservation where user_id=$1", [r1.user.user_id]))[0]!.s);
  expect(dayAfter - dayBefore).toBeCloseTo(spent, 5);
  console.log("ids", { candidate: id, parent: parent!.id, reservations: resv.length, calls: calls.length });
});

test("one_in_flight: a second request while queued or drafting returns the same candidate and writes no rows", async ({ browser }) => {
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const candRuns = () => db().count("run", "kind='candidate'");
  const runsBefore = await candRuns();
  const first = await regenerate(r1, "first");
  expect(first.status).toBe(202);
  const id = first.body["candidate_id"] as string;
  expect(await candRuns()).toBe(runsBefore + 1);

  // queued: nothing has claimed the job
  const queuedCounts = await counts();
  const again = await regenerate(r1, "second note");
  expect(again.status).toBe(202);
  expect(again.body["candidate_id"]).toBe(id);
  expect(await counts()).toEqual(queuedCounts);

  // drafting: the driver holds the model call
  const driver = driveCandidateBg("good", id, 6000);
  const seen = await candidateStatuses(r1, id, (c) => c.status === "drafting", 30_000);
  expect(seen.at(-1)).toBe("drafting");
  const draftingCounts = await counts();
  const third = await regenerate(r1);
  expect(third.status).toBe(202);
  expect(third.body["candidate_id"]).toBe(id);
  expect(await counts()).toEqual(draftingCounts);
  await driver;
  expect(await candRuns()).toBe(runsBefore + 1);
  expect(await db().count("lesson_job", "kind='candidate' and lesson_id=$1 and run_id=$2", [LESSON, id])).toBe(1);
  // reservations come from the worker, one candidate run: the same count however many times the route was called
  const resv = await db().count("spend_reservation", "run_id=$1", [id]);
  expect(resv).toBeGreaterThan(0);
  const solo = await makeCandidate(r1);
  expect(await db().count("spend_reservation", "run_id=$1", [solo.candidate_id])).toBe(resv);
  console.log("ids", { candidate: id, reservations: resv });
});

test("adopt: the whole candidate goes through collab as the second reviewer's logged edit", async ({ browser }) => {
  const s = await stack16();
  const r1 = await session(browser, "reviewer");
  const r2 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const edit = `Synthetic whole-adopt sentence ${Date.now().toString(36)}.`;
  const reg = await regenerate(r1);
  const id = reg.body["candidate_id"] as string;
  await driveCandidate("edit", id, 0, edit);
  const before = await liveHash();
  const docsBefore = await db().count("lesson_doc", "lesson_id=$1", [LESSON]);
  const rid = mkRequestId();
  const res = await adopt(r2, id, { scope: "whole" }, { "x-request-id": rid });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.headers["x-request-id"] ?? rid).toBe(rid);
  expect(res.body["last_editor"]).toBe(r2.user.name);
  expect(res.body["content_hash"]).not.toBe(before.doc_hash ?? before.lesson_hash);

  const docs = await db().query<{ seq: number; store_id: string; content_hash: string; stored_by: string | null; request_id: string | null }>(
    "select seq, store_id, content_hash, stored_by, request_id from lesson_doc where lesson_id=$1 order by seq", [LESSON]);
  const last = docs.at(-1)!;
  expect(docs.length).toBeGreaterThan(docsBefore);
  expect(last.content_hash).toBe(res.body["content_hash"]);
  expect(last.stored_by).toBe(r2.user.user_id);
  const [lesson] = await db().query<{ last_editor_id: string }>("select last_editor_id from lesson where id=$1", [LESSON]);
  expect(lesson!.last_editor_id).toBe(r2.user.user_id);
  const [ver] = await db().query<{ adopted: boolean }>("select adopted from lesson_version where run_id=$1 and lesson_id=$2", [id, LESSON]);
  expect(ver!.adopted).toBe(true);
  const audits = await db().query<{ action: string; actor_id: string; request_id: string | null; store_id: string | null; details_json: Record<string, unknown>; version_hash: string | null }>(
    "select action, actor_id, request_id, store_id, details_json, version_hash from audit_event where target_id=$1 and (details_json->>'run_id'=$2 or details_json->>'candidate_id'=$2) order by at", [LESSON, id]);
  expect(audits.map((a) => a.action)).toEqual(["candidate.regenerate", "candidate.adopt"]);
  expect(audits[0]!.actor_id).toBe(r1.user.user_id);
  expect(audits[1]).toMatchObject({ actor_id: r2.user.user_id, request_id: rid, store_id: last.store_id, version_hash: last.content_hash });
  expect(audits[1]!.details_json["scope"]).toBe("whole");
  // the collab server stored it under the candidate-adopt tag
  const tagged = tagLines(s.collabLog(), "candidate-adopt");
  expect(tagged.some((l) => l.includes(last.store_id))).toBe(true);
  // one transaction: every adopt store has its audit row
  expect(await db().count("lesson_doc", "lesson_id=$1 and store_id=$2", [LESSON, last.store_id])).toBe(1);
  expect(await db().count("audit_event", "store_id=$1 and action='candidate.adopt'", [last.store_id])).toBe(1);
  // the adopter is the last editor the API reports (the approver four-eyes rule is NL-53's; an approver cannot also be a reviewer)
  const got = await r2.page.request.get(`/api/lessons/${LESSON}`);
  expect((await got.json()).last_editor).toBe(r2.user.name);
  console.log("ids", { candidate: id, audit: res.body["audit_id"], store: last.store_id, hash: last.content_hash });
  // already adopted whole: a second whole adopt is refused
  const twice = await adopt(r2, id, { scope: "whole" });
  expect(twice.status).toBe(409);
});

test("adopt: one section changes only that section and leaves the candidate unflagged", async ({ browser }) => {
  const s = await stack16();
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const edit = `Synthetic section-adopt sentence ${Date.now().toString(36)}.`;
  const c = await makeCandidate(r1, "edit", { editText: edit });
  const target = sectionWith(c, edit);
  expect(target, "the edited sentence is in one candidate section").toBeTruthy();
  const docBefore = (await db().query<{ derived_json: unknown; seq: number }>("select derived_json, seq from lesson_doc where lesson_id=$1 order by seq desc limit 1", [LESSON]))[0];
  const rid = mkRequestId();
  const res = await adopt(r1, c.candidate_id, { scope: "section", section_address: target!.address }, { "x-request-id": rid });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const docAfter = (await db().query<{ derived_json: Json; seq: number; store_id: string; stored_by: string }>("select derived_json, seq, store_id, stored_by from lesson_doc where lesson_id=$1 order by seq desc limit 1", [LESSON]))[0]!;
  expect(docAfter.seq).toBeGreaterThan(docBefore?.seq ?? 0);
  expect(docAfter.stored_by).toBe(r1.user.user_id);
  expect(JSON.stringify(docAfter.derived_json)).toContain(edit);
  // the other sections are byte-identical to the candidate's/live copy they had: compare against the live lesson API
  const live = (await (await r1.page.request.get(`/api/lessons/${LESSON}`)).json()) as { sections: { address: string; content: unknown }[] };
  const adoptedSection = live.sections.find((x) => x.address === target!.address)!;
  expect(textOf(adoptedSection.content)).toContain(edit);
  for (const other of live.sections.filter((x) => x.address !== target!.address)) expect(textOf(other.content)).not.toContain(edit);
  const [ver] = await db().query<{ adopted: boolean }>("select adopted from lesson_version where run_id=$1 and lesson_id=$2", [c.candidate_id, LESSON]);
  expect(ver!.adopted).toBe(false); // only a whole adopt flips the flag
  const [aud] = await db().query<{ details_json: { scope: string; section_address: string }; actor_id: string; request_id: string; store_id: string }>(
    "select details_json, actor_id, request_id, store_id from audit_event where action='candidate.adopt' and details_json->>'candidate_id'=$1", [c.candidate_id]);
  expect(aud).toMatchObject({ actor_id: r1.user.user_id, request_id: rid, store_id: docAfter.store_id });
  expect(aud!.details_json).toMatchObject({ scope: "section", section_address: target!.address });
  expect(tagLines(s.collabLog(), "candidate-adopt").some((l) => l.includes(docAfter.store_id))).toBe(true);
  console.log("ids", { candidate: c.candidate_id, section: target!.address, store: docAfter.store_id });
});

test("collab_down: adopt answers 503 and changes nothing; after the restart the same adopt succeeds", async ({ browser }) => {
  const s = await stack16();
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const c = await makeCandidate(r1, "edit", { editText: `Synthetic collab-down sentence ${Date.now().toString(36)}.` });
  const before = await liveHash();
  const auditBefore = await db().count("audit_event", "action='candidate.adopt'");
  await s.stopCollab();
  try {
    const down = await adopt(r1, c.candidate_id, { scope: "whole" });
    expect(down.status, JSON.stringify(down.body)).toBe(503);
    expect(down.body["error"]?.code ?? down.body["code"]).toBe("COLLAB_UNAVAILABLE");
    const after = await liveHash();
    expect(after).toEqual(before);
    expect(await db().count("audit_event", "action='candidate.adopt'")).toBe(auditBefore);
    expect((await db().query<{ adopted: boolean }>("select adopted from lesson_version where run_id=$1", [c.candidate_id]))[0]!.adopted).toBe(false);
  } finally {
    await s.startCollab();
  }
  const up = await adopt(r1, c.candidate_id, { scope: "whole" });
  expect(up.status, JSON.stringify(up.body)).toBe(200);
  expect(up.body["content_hash"]).not.toBe(before.doc_hash ?? before.lesson_hash);
  console.log("collab_down: 503 then 200", { candidate: c.candidate_id });
});

test("failed_and_v1: a failed candidate leaves the live lesson alone; a generation_failed lesson gets the candidate as its v1", async ({ browser }) => {
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const before = await liveHash();
  const failed = await makeCandidate(r1, "fail");
  expect(failed.status).toBe("failed");
  expect(failed.failure_reasons.length).toBeGreaterThan(0);
  for (const f of failed.failure_reasons) expect(typeof f.check).toBe("string");
  expect(await liveHash()).toEqual(before);
  expect(await db().count("lesson_version", "lesson_id=$1 and run_id=$2", [LESSON, failed.candidate_id])).toBe(0);
  console.log("failed candidate", failed.candidate_id, failed.failure_reasons.map((f) => f.check).join(","));

  await ensureFailedLesson(browser);
  const l5before = await db().query("select state, current_version_id from lesson where id=$1", [L5]);
  expect(l5before[0]).toMatchObject({ state: "generation_failed", current_version_id: null });
  const reg = await regenerate(r1, undefined, undefined, L5);
  expect(reg.status, JSON.stringify(reg.body)).toBe(202);
  v1Candidate = reg.body["candidate_id"] as string;
  await driveCandidate("good", v1Candidate);
  const [l5] = await db().query<{ state: string; current_version_id: string | null }>("select state, current_version_id from lesson where id=$1", [L5]);
  expect(l5!.state).toBe("draft");
  expect(l5!.current_version_id).not.toBeNull();
  const vers = await db().query<{ kind: string; number: number; run_id: string; id: string }>("select kind, number, run_id, id from lesson_version where lesson_id=$1", [L5]);
  expect(vers).toHaveLength(1);
  expect(vers[0]).toMatchObject({ kind: "generated", number: 1, run_id: v1Candidate });
  expect(vers[0]!.id).toBe(l5!.current_version_id);
  expect(await liveHash()).toEqual(before); // L4 was not touched by the L5 regenerate
  console.log("v1 stored for", L5, v1Candidate);
});

// S-37 regression: when the candidate becomes the lesson's v1 its lesson_version.kind is 'generated'; the lookup must still find it.
test("failed_and_v1: the API reports the candidate that became v1 as ready", async ({ browser }) => {
  expect(v1Candidate, "the previous failed_and_v1 test must have run").not.toBe("");
  const r1 = await session(browser, "reviewer");
  const g = await getCandidate(r1, v1Candidate, L5);
  expect(g.body["status"]).toBe("ready");
});
const walk = (n: unknown, f: (o: Record<string, unknown>) => void): void => {
  if (Array.isArray(n)) n.forEach((x) => walk(x, f));
  else if (n && typeof n === "object") {
    f(n as Record<string, unknown>);
    Object.values(n).forEach((x) => walk(x, f));
  }
};

test("text_not_html: script markup in model text shows as text, never runs, and is stored as a text node", async ({ browser }) => {
  const st = await stack16();
  const r1 = await session(browser, "reviewer");
  const r2 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const MARKUP = "<script>window.__pwn=1</script>";
  const c = await makeCandidate(r1, "markup");
  expect(c.status).toBe("ready");
  const target = sectionWith(c, "__pwn");
  expect(target, "the markup sits in one candidate section").toBeTruthy();
  await bridgeCollab(r2, st.collabPort);
  await r2.page.goto(scr12(c.candidate_id));
  await expect(r2.page.getByTestId("hp5-note")).toBeVisible({ timeout: 30_000 });
  await expect(r2.page.getByText(MARKUP).first()).toBeVisible();
  expect(await r2.page.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
  expect(await r2.page.locator("main script", { hasText: "__pwn" }).count()).toBe(0);
  expect(await r2.page.locator("main").evaluate((m, t) => m.innerHTML.includes(t), MARKUP)).toBe(false); // escaped, so the raw tag is not in the markup

  const res = await adopt(r2, c.candidate_id, { scope: "section", section_address: target!.address });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const [doc] = await db().query<{ derived_json: unknown }>("select derived_json from lesson_doc where lesson_id=$1 order by seq desc limit 1", [LESSON]);
  const types = new Set<string>();
  let literal = false;
  walk(doc!.derived_json, (o) => {
    if (typeof o["type"] === "string") types.add(o["type"]);
    if (o["type"] === "text" && typeof o["text"] === "string" && o["text"].includes(MARKUP)) literal = true;
  });
  expect(literal, "the markup is stored as the text of a text node").toBe(true);
  expect(types.has("script")).toBe(false);
  await r2.page.goto(scr9);
  await expect(r2.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  expect(await r2.page.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
  console.log("text_not_html: __pwn undefined on SCR-12 and SCR-9; node types", [...types].join(","));
});

test("reachability: a reviewer asks for a fresh draft in the workspace, compares it and takes sections and the whole", async ({ browser }) => {
  const st = await stack16();
  const r1 = await session(browser, "reviewer");
  const r2 = await session(browser, "reviewer");
  await ensureInReview(r1);
  await bridgeCollab(r1, st.collabPort);
  await bridgeCollab(r2, st.collabPort);
  const before = await liveHash();
  const { page } = r1;
  await page.goto(scr9);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Regenerate…" }).first().click();
  await page.getByLabel("Note (optional)").fill("synthetic ui note");
  const posted = page.waitForResponse((r) => r.request().method() === "POST" && /\/candidates$/.test(r.url()));
  await page.getByRole("dialog").getByRole("button", { name: "Regenerate", exact: true }).click();
  const id = ((await (await posted).json()) as { candidate_id: string }).candidate_id;
  const edit = `Synthetic reachability sentence ${Date.now().toString(36)}.`;
  const driver = driveCandidateBg("edit", id, 3000, edit);
  await expect(page.getByTestId("regen-status")).toContainText("Drafting a candidate");
  await page.getByRole("link", { name: "Compare the candidate" }).click({ timeout: 60_000 });
  await expect(page).toHaveURL(new RegExp(`${scr12(id)}$`));
  await driver;
  await expect(page.getByRole("heading", { level: 1 })).toContainText("not adopted");
  expect((await getCandidate(r1, id)).body["current_content_hash"]).toBe(before.lesson_hash);
  expect((await liveHash()).lesson_hash).toBe(before.lesson_hash);

  // a second reviewer takes one section, then the whole candidate, and is handed back to SCR-9
  const p2 = r2.page;
  await p2.goto(scr12(id));
  await expect(p2.getByTestId("hp5-note")).toBeVisible({ timeout: 30_000 });
  await p2.getByRole("button", { name: /^Adopt this section: Launch$/ }).click();
  await expect(p2.getByText(`Adopted by ${r2.user.name}`)).toBeVisible({ timeout: 30_000 });
  await expect(p2.getByText(/adopted from candidate v\d+\. Logged as your edit\./).first()).toBeVisible();
  await p2.reload();
  await p2.getByRole("button", { name: "Adopt whole candidate" }).click();
  await expect(p2.getByText(/^Candidate v\d+ adopted\. Logged as your edit\.$/).first()).toBeVisible({ timeout: 30_000 });
  await p2.waitForURL(new RegExp(`${scr9}$`), { timeout: 15_000 });
  expect(((await (await p2.request.get(`/api/lessons/${LESSON}`)).json()) as { last_editor: string }).last_editor).toBe(r2.user.name);
  console.log("reachability: candidate", id, "adopted by", r2.user.user_id);
});

test("reachability: an author opening the compare screen sees the role note and no take-up controls", async ({ browser }) => {
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const c = await makeCandidate(r1);
  const author = await session(browser, "author");
  await author.page.goto(scr12(c.candidate_id));
  await expect(author.page.getByTestId("hp5-note")).toBeVisible({ timeout: 30_000 });
  await expect(author.page.getByText("Only reviewers adopt candidates")).toBeVisible();
  expect(await author.page.getByRole("button", { name: /Adopt/ }).count()).toBe(0);
});
