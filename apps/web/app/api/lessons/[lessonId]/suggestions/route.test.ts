// NL-50 route tests: the real handlers over with_route and the real service (in-memory doubles).
import { describe, expect, it } from "vitest";
import { make_with_route } from "../../../../../src/server/http/with-route.ts";
import { make_deps, make_request } from "../../../../../src/server/http/testing/route-fixtures.ts";
import { build_service, ANCHOR, LID, NOTE, SELECTION } from "../../../../../src/server/services/suggestion-service.fixtures.ts";
import { make_suggestion_handlers } from "./http.ts";

function setup() {
  const t = build_service();
  const handlers = make_suggestion_handlers({
    with_route: make_with_route(make_deps().deps),
    suggestions: () => t.service,
  });
  const body = { anchor: ANCHOR, selected_text: SELECTION, note: NOTE };
  const post = (token: string, b: unknown) =>
    handlers.request(make_request({ method: "POST", token, path_params: { lessonId: LID }, body: b as never }));
  const decide = (id: string, decision: "accept" | "reject") =>
    handlers.decide(
      make_request({ method: "POST", token: "reviewer-token", path_params: { lessonId: LID, suggestionId: id }, body: { decision } }),
    );
  return { t, handlers, body, post, decide };
}

describe("suggestion routes", () => {
  it("test_ai_assist_capture", async () => {
    const { t, post, decide, body } = setup();
    const r1 = await post("reviewer-token", body);
    expect(r1.status).toBe(201);
    const r2 = await post("reviewer-token", body);
    expect(r2.status).toBe(201);
    const id1 = (r1.body as { suggestion_id: string }).suggestion_id;
    const id2 = (r2.body as { suggestion_id: string }).suggestion_id;
    expect((await decide(id1, "accept")).status).toBe(200);
    expect((await decide(id2, "reject")).status).toBe(200);

    expect(t.repo.rows.map((r) => r.status)).toEqual(["accepted", "rejected"]);
    expect(t.repo.rows.map((r) => r.model_call_id)).toEqual(["mc_" + "1".repeat(26), "mc_" + "2".repeat(26)]);
    expect(t.collab.calls).toHaveLength(1);
    expect(t.collab.calls[0]!.tag).toBe("ai-assist");
    expect(t.collab.calls[0]!.actor.name).toBe("Test reviewer");
    expect(t.audit.events.map((e) => e.action)).toEqual([
      "suggestion.request",
      "suggestion.request",
      "suggestion.accept",
      "suggestion.reject",
    ]);
  });

  it("author_forbidden_extra_key_and_list", async () => {
    const { t, handlers, post, body } = setup();
    const forbidden = await post("valid-token", body);
    expect(forbidden.status).toBe(403);
    expect((forbidden.body as { error: { code: string } }).error.code).toBe("ROLE_FORBIDDEN");
    expect(t.paid.calls).toHaveLength(0);
    const extra = await post("reviewer-token", { ...body, extra: 1 });
    expect(extra.status).toBe(400);
    expect((extra.body as { error: { code: string } }).error.code).toBe("INVALID_REQUEST");
    const list = await handlers.list(make_request({ method: "GET", token: "valid-token", path_params: { lessonId: LID } }));
    expect(list.status).toBe(200);
  });
});
