// NL-48
import { DomainRefusal } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import type { RequestUser } from "@ls/core/ports/common";
import { describe, expect, it } from "vitest";
import { make_deps, make_request } from "@/server/http/testing/route-fixtures";
import { make_with_route, type HttpRequest, type SessionResolver } from "@/server/http/with-route";
import { make_heartbeat_handlers, to_http_request, to_response } from "@/server/routes/heartbeat-routes";
import { HeartbeatService } from "@/server/services/heartbeat-service";
import { InMemoryMetricsRepo, known_lessons } from "@/server/services/metrics-test-fakes";

const LESSON = "G6.U4.L1";
const mk = (role: RequestUser["role"], request_id: string, synthetic: boolean): RequestUser => ({
  user_id: synthetic ? "usr_synth" : `usr_${role}`, name: `Test ${role}`, email: `${role}@example.test`, role, synthetic, request_id,
} as RequestUser);
const resolver: SessionResolver = {
  async require(token, request_id) {
    if (token === "reviewer-token") return mk("reviewer", request_id, false);
    if (token === "synthetic-token") return mk("reviewer", request_id, true);
    if (token === "author-token") return mk("author", request_id, false);
    throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
  },
};

function setup() {
  const repo = new InMemoryMetricsRepo();
  const clock = new FakeClock(new Date("2026-10-01T10:00:00.000Z"));
  const svc = new HeartbeatService(repo, clock, { heartbeat_merge_gap_s: 60, heartbeat_min_spacing_s: 10 }, known_lessons([LESSON]));
  const d = make_deps({ sessions: () => resolver });
  const h = make_heartbeat_handlers({ with_route: make_with_route(d.deps), heartbeats: () => svc });
  return { repo, clock, ...h };
}
const body = (clock: FakeClock, over: Record<string, unknown> = {}) => ({
  tab_id: "tab-1", focused: true, visible: true, last_input_at: clock.now().toISOString(), sent_at: clock.now().toISOString(),
  version_id: "lv_0123456789ABCDEFGHJKMNPQRS", ...over,
});
const req = (token: string | null, b: unknown, lesson = LESSON): HttpRequest =>
  make_request({ token, path_params: { lessonId: lesson }, body: b as HttpRequest["body"] });

describe("heartbeat route", () => {
  it("refusals_401_403_404", async () => {
    const s = setup();
    const b = body(s.clock);
    expect((await s.send_heartbeat(req(null, b))).status).toBe(401);
    expect((await s.send_heartbeat(req("author-token", b))).status).toBe(403);
    expect((await s.send_heartbeat(req("reviewer-token", b, "G6.U4.L99"))).status).toBe(404);
    expect(s.repo.heartbeats).toHaveLength(0);
    expect(s.repo.sessions).toHaveLength(0);
  });

  it("test_heartbeat_capture", async () => {
    const s = setup();
    for (const token of ["reviewer-token", "synthetic-token"]) {
      const first = await s.send_heartbeat(req(token, body(s.clock)));
      expect(first.status).toBe(204);
      expect(first.body).toBeNull();
      s.clock.advance(15_000);
      expect((await s.send_heartbeat(req(token, body(s.clock)))).status).toBe(204);
      s.clock.advance(15_000);
    }
    expect(s.repo.heartbeats).toHaveLength(4);
    expect(s.repo.heartbeats[0]).toMatchObject({ user_id: "usr_reviewer", tab_id: "tab-1", synthetic: false, version_id: "lv_0123456789ABCDEFGHJKMNPQRS" });
    expect(s.repo.heartbeats[2]?.synthetic).toBe(true);
    expect(s.repo.sessions.map((x) => x.active_seconds)).toEqual([15, 15]);
  });

  it("no_minutes_with_name", async () => {
    const s = setup();
    const res = await s.send_heartbeat(req("reviewer-token", body(s.clock)));
    const dump = JSON.stringify({ body: res.body, headers: res.headers });
    for (const w of ["name", "email", "Test reviewer", "active_minutes", "active_seconds"]) expect(dump).not.toContain(w);
    const out = to_response(res);
    expect(out.status).toBe(204);
    expect(await out.text()).toBe("");
  });

  it("invalid_body_400", async () => {
    const s = setup();
    const { tab_id: _omit, ...rest } = body(s.clock);
    void _omit;
    const res = await s.send_heartbeat(req("reviewer-token", rest));
    expect(res.status).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe("INVALID_REQUEST");
    expect(s.repo.heartbeats).toHaveLength(0);
  });

  it("bridge_maps_request", () => {
    const r = new Request("https://app.example.test/api/lessons/G6.U4.L1/heartbeats?x=1", {
      method: "POST", headers: { cookie: "ls_session=abc%20d; other=1", Origin: "https://app.example.test" },
    });
    const h = to_http_request(r, { lessonId: "G6.U4.L1" }, { a: 1 });
    expect(h.cookies["ls_session"]).toBe("abc d");
    expect(h.headers["origin"]).toBe("https://app.example.test");
    expect(h.query).toEqual({ x: "1" });
    expect(h.body).toEqual({ a: 1 });
  });
});
