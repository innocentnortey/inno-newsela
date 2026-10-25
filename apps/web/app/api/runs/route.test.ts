// NL-27: POST /api/runs through with_route with the in-memory service.
import { describe, expect, it } from "vitest";
import { make_with_route } from "@/server/http/with-route";
import { APP_ORIGIN, make_deps, make_request } from "@/server/http/testing/route-fixtures";
import { make_start_run_handler } from "@/server/services/run-start-route";
import { build_outline, make_service, OUTLINE_VERSION_ID, PROMPT_VERSION_ID } from "@/server/services/testing/run-service-fakes";
import { FakeSpendLedger } from "@ls/core/testing/fake-spend";
import { POST } from "./route";

const body = (over: Record<string, unknown> = {}) => ({
  outline_version_id: OUTLINE_VERSION_ID, mode: "run", scope: { kind: "all" }, prompt_version_id: PROMPT_VERSION_ID, cap_usd: 13, ...over,
});
function setup(kit = make_service()) {
  const d = make_deps();
  const handler = make_start_run_handler(make_with_route(d.deps), () => kit.service);
  return { kit, handler, ...d };
}
const call = (h: ReturnType<typeof setup>["handler"], over: Record<string, unknown> = {}, req: Parameters<typeof make_request>[0] = {}) =>
  h(make_request({ body: body(over) as never, ...req }));

interface Body { state?: string; run_id?: string; error: { code: string } }
const B = (r: { body: unknown }): Body => r.body as Body;

describe("POST /api/runs", () => {
  it("precedence: schema, then role, then the service's own order", async () => {
    // 1 role: a reviewer with a valid body
    const s = setup();
    const r1 = await call(s.handler, {}, { token: "reviewer-token" });
    expect([r1.status, B(r1).error.code]).toEqual([403, "ROLE_FORBIDDEN"]);
    // 2 trial without lesson_id
    const r2 = await call(s.handler, { mode: "trial" });
    expect(B(r2).error.code).toBe("INVALID_REQUEST");
    // 3 cap 0 (schema)
    const r3 = await call(s.handler, { cap_usd: 0 });
    expect(B(r3).error.code).toBe("INVALID_REQUEST");
    // 4 unknown row
    const r4 = await call(s.handler, { scope: { kind: "rows", rows: [999] } });
    expect(B(r4).error.code).toBe("INVALID_REQUEST");
    // 5 unknown outline version
    const r5 = await call(s.handler, { outline_version_id: "G6.U4.ov7" });
    expect([r5.status, B(r5).error.code]).toEqual([404, "NOT_FOUND"]);
    // 6 unconfirmed error beats a day-cap breach
    const k = make_service({ outline: build_outline({ errors_unconfirmed: true }) });
    const spend = new FakeSpendLedger();
    spend.script.returns("check_day_cap", { allowed: false, refused_by: "day_cap", scope: "user", remaining_usd: null } as never);
    (k.service as unknown as { spend: unknown }).spend = spend;
    const r6 = await call(setup(k).handler);
    expect([r6.status, B(r6).error.code]).toEqual([422, "VALIDATION_INCOMPLETE"]);
    for (const r of [r1, r2, r3, r4, r5]) expect(r.status).toBeGreaterThanOrEqual(400);
    expect(s.kit.runs.inserted).toHaveLength(0);
  });

  it("success is 201 in state planning, and the Idempotency-Key reaches the service", async () => {
    const s = setup();
    const headers = { "idempotency-key": "k1", origin: APP_ORIGIN };
    const a = await call(s.handler, {}, { headers });
    expect(a.status).toBe(201);
    expect(B(a).state).toBe("planning");
    const b = await call(s.handler, {}, { headers });
    expect(B(b).run_id).toBe(B(a).run_id);
    expect(s.kit.runs.inserted).toHaveLength(1);
  });

  it("exports a POST handler", () => {
    expect(typeof POST).toBe("function");
  });
});
