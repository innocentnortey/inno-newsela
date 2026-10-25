// NL-36 AC-8 (success_paths): one POST each, bearer header, request id, JSON body, parsed results with revived dates.
import { SecretStr } from "@ls/config/secret";
import { FakeClock } from "@ls/core/ports/clock";
import { describe, expect, it } from "vitest";
import { HttpCollabCommandClient } from "./collab-commands.ts";

const LESSON = "G6.U4.L4";
const REQ = "req_01HZ0000000000000000000001";
const USER = "usr_01HZ0000000000000000000002";
const ACTOR = { user_id: USER, name: "Ada Test", role: "reviewer" as const, synthetic: true };
const HASH = "a".repeat(64);

function client(body: unknown) {
  const seen: { url: string; init: RequestInit }[] = [];
  const fetch_impl = (async (u: unknown, init?: RequestInit) => {
    seen.push({ url: String(u), init: init ?? {} });
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  const logger = { info() {}, warn() {}, error() {} };
  const c = new HttpCollabCommandClient(
    { base_url: "http://collab.internal:4100/", token: new SecretStr("tok"), timeout_ms: 5000 },
    { clock: new FakeClock(new Date("2026-10-01T10:00:00.000Z")), logger, fetch_impl },
  );
  return { c, seen };
}
function check(seen: { url: string; init: RequestInit }[], route: string, body: unknown) {
  expect(seen).toHaveLength(1);
  expect(seen[0]!.url).toBe(`http://collab.internal:4100/lessons/${LESSON}/${route}`);
  const h = new Headers(seen[0]!.init.headers);
  expect(h.get("authorization")).toBe("Bearer tok");
  expect(h.get("x-request-id")).toBe(REQ);
  expect(JSON.parse(String(seen[0]!.init.body))).toEqual(body);
}

describe("success_paths [AC-8]", () => {
  it("lock_and_snapshot", async () => {
    const res = {
      lesson_id: LESSON, version_id: "lv_01HZ0000000000000000000003", version_number: 2, content_hash: HASH,
      state_vector: "AQID", review_event_id: "ev1", from_state: "in_review", to_state: "submitted",
    };
    const { c, seen } = client(res);
    const cmd = { lesson_id: LESSON, actor: ACTOR, client_state_vector: "AQID", request_id: REQ };
    expect(await c.lock_and_snapshot(cmd)).toEqual(res);
    check(seen, "lock-and-snapshot", cmd);
  });

  it("apply_edit revives stored_at", async () => {
    const res = {
      lesson_id: LESSON, store_id: "st_01HZ0000000000000000000004", seq: 3, content_hash: HASH, state_vector: "AQID",
      stored_at: "2026-10-01T10:00:00.000Z", stored_by: USER, check_job_enqueued: true,
    };
    const { c, seen } = client(res);
    const cmd = {
      lesson_id: LESSON, actor: ACTOR, tag: "standard-decision" as const, request_id: REQ,
      edit: { kind: "standard" as const, code: "CCSS.ELA-LITERACY.RL.6.1", decision: "confirm" as const, restore: null },
    };
    const ack = await c.apply_edit(cmd);
    expect(ack.stored_at).toBeInstanceOf(Date);
    expect(ack.stored_at.toISOString()).toBe(res.stored_at);
    expect(ack).toMatchObject({ seq: 3, stored_by: USER, check_job_enqueued: true });
    check(seen, "apply-edit", cmd);
  });

  it("set_mode", async () => {
    const res = { lesson_id: LESSON, mode: "read_only", connections_notified: 2 };
    const { c, seen } = client(res);
    const cmd = { lesson_id: LESSON, mode: "read_only" as const, state: "submitted" as const, request_id: REQ };
    expect(await c.set_mode(cmd)).toEqual(res);
    check(seen, "set-mode", cmd);
  });
});
