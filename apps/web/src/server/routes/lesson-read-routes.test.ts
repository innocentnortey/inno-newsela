import { describe, expect, it } from "vitest";
import { DomainRefusal } from "@ls/core/errors";
import type { RequestUser } from "@ls/core/ports/common";
import { make_with_route, type HttpRequest, type SessionResolver } from "../http/with-route.ts";
import { make_deps } from "../http/testing/route-fixtures.ts";
import { XSS, crock, lesson_row, make_lesson, make_service, make_world, H1, SV, type World } from "../services/lesson-read-fixtures.ts";
import { make_lesson_read_handlers, to_http_request, to_response } from "./lesson-read-routes.ts";

const mk = (role: RequestUser["role"], request_id: string): RequestUser => ({
  user_id: crock("usr", role === "reviewer" ? "4" : "8"),
  name: `Test ${role}`, email: `${role}@example.test`, role, synthetic: true, request_id,
});
const resolver: SessionResolver = {
  async require(token, request_id) {
    if (token === "author-token") return mk("author", request_id);
    if (token === "reviewer-token") return mk("reviewer", request_id);
    if (token === "approver-token") return mk("approver", request_id);
    throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
  },
};

function setup(w: World) {
  const d = make_deps({ sessions: () => resolver });
  const svc = make_service(w);
  const h = make_lesson_read_handlers({
    with_route: make_with_route(d.deps),
    reads: () => svc,
    logger: d.deps.logger,
    now_ms: (() => { let t = 0; return () => (t += 7); })(),
  });
  return { ...h, lines: d.lines };
}
const req = (lessonId: string, token = "reviewer-token"): HttpRequest => ({
  method: "GET", path_params: { lessonId }, query: {}, headers: {}, body: null, cookies: { ls_session: token },
});

describe("lesson read routes", () => {
  it("schema_unknown_and_not_found: 500 without lesson text, 404", async () => {
    const lesson = make_lesson();
    (lesson.sections[0] as { content: unknown }).content = {
      type: "doc", content: [{ type: "blink", content: [{ type: "text", text: "SECRET-TEXT" }] }],
    };
    const bad = setup(make_world({ derived: { lesson, content_hash: H1, state_vector: SV, schema_version: 1 } }));
    const r = await bad.get_lesson(req("G6.U4.L4"));
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain("SECRET-TEXT");
    expect((r.body as { error: { code: string } }).error.code).toBe("SCHEMA_UNKNOWN");
    const missing = setup(make_world({ row: null }));
    expect((await missing.get_lesson(req("G6.U4.L4"))).status).toBe(404);
  });

  it("both_id_forms: canonical and short ids give equal bodies; malformed is 400", async () => {
    const s = setup(make_world());
    const a = await s.get_lesson(req("G6.U4.L4"));
    const b = await s.get_lesson(req("g6-u4:L4"));
    expect(a.status).toBe(200);
    expect(b.body).toEqual(a.body);
    const bad = await s.get_lesson(req("g6-u4"));
    expect(bad.status).toBe(400);
    expect((bad.body as { error: { code: string } }).error.code).toBe("INVALID_REQUEST");
  });

  it("text_never_html_and_no_minutes: strings stay strings, no html or minutes keys", async () => {
    const s = setup(make_world({ outline_segments: [{ kind: "content", text: XSS, instruction_shaped: false, applies: "apply" }] }));
    const res = await s.get_lesson(req("G6.U4.L4"));
    expect(await to_response(res).json()).toEqual(res.body);
    const wire = JSON.parse(JSON.stringify(res.body)) as unknown;
    expect((wire as { outline_row: { segments: { text: string }[] } }).outline_row.segments[0]?.text).toBe(XSS);
    const bad: string[] = [];
    const scan = (v: unknown, path: string): void => {
      if (Array.isArray(v)) v.forEach((x) => scan(x, `${path}[]`));
      else if (v !== null && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
          const p = `${path}.${k}`;
          if (k === "html" || (/minutes/i.test(k) && p !== ".sections[].minutes" && p !== ".front_matter.minutes_total")) bad.push(p);
          scan(x, p);
        }
      }
    };
    scan(wire, "");
    expect(bad).toEqual([]);
  });

  it("test_lesson_open_logs_latency: one lesson.open line, no writes, 404 history logs no text", async () => {
    const w = make_world({ row: lesson_row({ state: "draft" }) });
    const s = setup(w);
    await s.get_lesson(req("G6.U4.L4"));
    const opens = s.lines.map((l) => JSON.parse(l) as Record<string, unknown>).filter((l) => l["event"] === "lesson.open");
    expect(opens).toHaveLength(1);
    expect(opens[0]).toMatchObject({ lesson_id: "G6.U4.L4", extra: { version_id: w.row?.current_version_id } });
    expect(typeof opens[0]?.["duration_ms"]).toBe("number");
    expect(w.writes).toBe(0);

    const none = setup(make_world({ row: null }));
    const h = await none.get_history(req("G6.U4.L4"));
    expect(h.status).toBe(404);
    expect(none.lines.filter((l) => l.includes("lesson.open"))).toHaveLength(0);
    expect(none.lines.join("\n")).not.toContain("body");
  });

  it("to_http_request_cookie_and_params: cookies, query, decoded params, lower-case headers", () => {
    const r = to_http_request(
      new Request("https://app.example.test/api/lessons/g6-u4%3AL4?x=1&x=2", { headers: { Cookie: "ls_session=tok; other=a%20b", "X-Request-Id": "z" } }),
      { lessonId: "g6-u4%3AL4" },
    );
    expect(r.path_params["lessonId"]).toBe("g6-u4:L4");
    expect(r.cookies).toEqual({ ls_session: "tok", other: "a b" });
    expect(r.query).toEqual({ x: ["1", "2"] });
    expect(r.headers["x-request-id"]).toBe("z");
    expect(r.body).toBeNull();
  });
});
