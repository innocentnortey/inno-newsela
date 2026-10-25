// NL-114 AC-5: every refusal of the two candidate routes, and that each one writes nothing.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { adopt, api, counts, driveCandidate, ensureInReview, ensureLesson, LESSON, makeCandidate, regenerate, session, setLessonState, settleCandidates, stopStack16, type Session } from "./helpers";
import type { Json } from "./helpers";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
test.beforeAll(async ({ browser }) => {
  await ensureLesson(browser);
});
test.afterAll(stopStack16);
test.afterEach(async () => {
  await settleCandidates();
  await setLessonState("in_review");
});

const code = (b: Json): string => b["error"]?.code ?? b["code"];
async function nothingWritten(run: () => Promise<{ status: number; body: Json }>): Promise<{ status: number; body: Json }> {
  const before = await counts();
  const r = await run();
  expect(await counts()).toEqual(before);
  return r;
}

test("refusals: ROLE_FORBIDDEN 403 for an author on both routes", async ({ browser }) => {
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const c = await makeCandidate(r1);
  const author = await session(browser, "author");
  const a = await nothingWritten(() => regenerate(author));
  expect([a.status, code(a.body)]).toEqual([403, "ROLE_FORBIDDEN"]);
  const b = await nothingWritten(() => adopt(author, c.candidate_id, { scope: "whole" }));
  expect([b.status, code(b.body)]).toEqual([403, "ROLE_FORBIDDEN"]);
  const approver = await session(browser, "approver");
  const d = await nothingWritten(() => regenerate(approver));
  expect([d.status, code(d.body)]).toEqual([403, "ROLE_FORBIDDEN"]);
  console.log("refusals ROLE_FORBIDDEN 403 x3 rows unchanged");
});

test("refusals: INVALID_TRANSITION 409 for a candidate that is not ready and for a second whole take-up", async ({ browser }) => {
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const q = await regenerate(r1);
  expect(q.status).toBe(202);
  const queued = await nothingWritten(() => adopt(r1, q.body["candidate_id"], { scope: "whole" }));
  expect([queued.status, code(queued.body)]).toEqual([409, "INVALID_TRANSITION"]);
  expect(queued.body["error"]?.details?.reason ?? queued.body["details"]?.reason).toBe("not_ready");
  await driveCandidate("edit", q.body["candidate_id"], 0, `Synthetic refusal sentence ${Date.now().toString(36)}.`);
  const ok = await adopt(r1, q.body["candidate_id"], { scope: "whole" });
  expect(ok.status, JSON.stringify(ok.body)).toBe(200);
  const twice = await nothingWritten(() => adopt(r1, q.body["candidate_id"], { scope: "whole" }));
  expect([twice.status, code(twice.body)]).toEqual([409, "INVALID_TRANSITION"]);
  expect(twice.body["error"]?.details?.reason ?? twice.body["details"]?.reason).toBe("already_adopted");
  console.log("refusals INVALID_TRANSITION 409 x2 rows unchanged");
});

test("refusals: LESSON_LOCKED 409 for a submitted lesson and for a draft that is not in review", async ({ browser }) => {
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  for (const state of ["submitted", "draft"]) {
    await setLessonState(state);
    const r = await nothingWritten(() => regenerate(r1));
    expect([r.status, code(r.body), state]).toEqual([409, "LESSON_LOCKED", state]);
  }
  console.log("refusals LESSON_LOCKED 409 x2 (submitted, draft) rows unchanged");
});

test("refusals: DAY_CAP_REACHED 422 when the requester's day is spent", async ({ browser }) => {
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const id = `sr_e2e_cap_${Date.now().toString(36)}`;
  // Synthetic row: the whole day cap (RUN_CAP_DEFAULT_USD 13.00 x USER_DAY_CAP_MULTIPLIER 2 = 26.00) reserved for this one user today,
  // no run and no job. Columns written: id, user_id, purpose, reserved_usd, settled_usd, status, day. Removed afterwards.
  await db().query(
    "insert into spend_reservation (id, run_id, job_id, user_id, purpose, reserved_usd, settled_usd, status, day) values ($1, null, null, $2, 'synthetic', 26.000000, 0, 'reserved', to_char(now() at time zone 'utc', 'YYYY-MM-DD'))",
    [id, r1.user.user_id],
  );
  try {
    const r = await nothingWritten(() => regenerate(r1));
    expect([r.status, code(r.body)]).toEqual([422, "DAY_CAP_REACHED"]);
    const other = await session(browser, "reviewer");
    const fine = await regenerate(other); // another reviewer's day is unaffected
    expect(fine.status).toBe(202);
  } finally {
    await db().query("delete from spend_reservation where id=$1", [id]);
  }
  console.log("refusals DAY_CAP_REACHED 422 rows unchanged");
});

test("refusals: INVALID_REQUEST 400 for a section take-up without an address or with an unknown one", async ({ browser }) => {
  const r1 = await session(browser, "reviewer");
  await ensureInReview(r1);
  const c = await makeCandidate(r1);
  for (const body of [{ scope: "section" as const }, { scope: "section" as const, section_address: "G6.U4.L4.no-such-section" }]) {
    const r = await nothingWritten(() => adopt(r1 as Session, c.candidate_id, body));
    expect([r.status, code(r.body)]).toEqual([400, "INVALID_REQUEST"]);
  }
  const unknown = await nothingWritten(() => api.post(r1.page, r1.origin, `/api/lessons/${LESSON}/candidates/run_01ZZZZZZZZZZZZZZZZZZZZZZZZ/adopt`, { scope: "whole" }));
  expect([unknown.status, code(unknown.body)]).toEqual([404, "NOT_FOUND"]);
  console.log("refusals INVALID_REQUEST 400 x2 and NOT_FOUND 404 rows unchanged");
});
