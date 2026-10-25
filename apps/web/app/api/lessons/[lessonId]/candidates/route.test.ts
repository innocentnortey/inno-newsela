import { describe, expect, it } from "vitest";
import { make_with_route } from "@/server/http/with-route";
import { make_deps, make_request } from "@/server/http/testing/route-fixtures";
import {
  make_candidate_handlers,
  with_optional_body,
} from "@/server/routes/candidate-routes";
import { to_http_request } from "@/server/http/next-adapter";
import {
  finish_candidate,
  H0,
  H1,
  L4,
  make_service,
  make_world,
} from "@/server/services/candidate-fixtures";

function build() {
  const w = make_world();
  const h = make_candidate_handlers({
    with_route: make_with_route(make_deps().deps),
    candidates: () => make_service(w),
  });
  const req = (
    token: string,
    path_params: Record<string, string>,
    body: unknown = {},
    method = "POST",
  ) => make_request({ token, method, path_params, body: body as never });
  return { w, h, req };
}
type Body = Record<string, unknown> & { error?: { code: string } };

describe("candidate routes", () => {
  it("test_candidate_capture: regenerate, poll, adopt over the real handlers", async () => {
    const { w, h, req } = build();
    const lessonId = L4;
    const r = await h.regenerate_lesson(req("reviewer-token", { lessonId }));
    const created = r.body as Body;
    expect(r.status).toBe(202);
    expect(created).toMatchObject({
      status: "queued",
      current_content_hash: H0,
    });
    expect([w.runs.length - 1, w.jobs.length - 1, w.audit.length]).toEqual([
      1, 1, 1,
    ]);
    const candidateId = created["candidate_id"] as string;
    const p = { lessonId, candidateId };

    const q = await h.get_candidate(req("reviewer-token", p, null, "GET"));
    expect(q.body).toMatchObject({
      status: "queued",
      current_content_hash: H0,
    });

    finish_candidate(w, candidateId);
    const rd = await h.get_candidate(req("reviewer-token", p, null, "GET"));
    expect(rd.body).toMatchObject({
      status: "ready",
      current_content_hash: H0,
      version_number: 2,
      adopted: false,
    });

    const a = await h.adopt_candidate(
      req("reviewer-token", p, { scope: "whole" }),
    );
    expect(a.status).toBe(200);
    expect((a.body as Body)["content_hash"]).toBe(H1);
    expect(H1).not.toBe(H0);
    expect(w.audit.map((x) => x.action)).toContain("candidate.adopt");

    const after = await h.get_candidate(req("reviewer-token", p, null, "GET"));
    expect(after.body).toMatchObject({ adopted: true });
  });

  it("collab_down_503", async () => {
    const { w, h, req } = build();
    const id = (
      (await h.regenerate_lesson(req("reviewer-token", { lessonId: L4 })))
        .body as Body
    )["candidate_id"] as string;
    finish_candidate(w, id);
    w.collab_down = true;
    const a = await h.adopt_candidate(
      req(
        "reviewer-token",
        { lessonId: L4, candidateId: id },
        { scope: "whole" },
      ),
    );
    expect(a.status).toBe(503);
    expect((a.body as Body).error?.code).toBe("COLLAB_UNAVAILABLE");
  });

  it("author_403", async () => {
    const { w, h, req } = build();
    const id = (
      (await h.regenerate_lesson(req("reviewer-token", { lessonId: L4 })))
        .body as Body
    )["candidate_id"] as string;
    finish_candidate(w, id);
    const p = { lessonId: L4, candidateId: id };
    for (const r of [
      await h.regenerate_lesson(req("valid-token", { lessonId: L4 })),
      await h.adopt_candidate(req("valid-token", p, { scope: "whole" })),
    ]) {
      expect(r.status).toBe(403);
      expect((r.body as Body).error?.code).toBe("ROLE_FORBIDDEN");
    }
    expect(
      (await h.get_candidate(req("valid-token", p, null, "GET"))).status,
    ).toBe(200);
  });

  it("regenerate_empty_body", async () => {
    const { h, req } = build();
    expect(
      (await h.regenerate_lesson(req("reviewer-token", { lessonId: L4 }, {})))
        .status,
    ).toBe(202);
    const w2 = build();
    expect(
      (
        await w2.h.regenerate_lesson(
          w2.req(
            "reviewer-token",
            { lessonId: L4 },
            { note: "Make the Look Back more open-ended." },
          ),
        )
      ).status,
    ).toBe(202);
    const w3 = build();
    const bad = await w3.h.regenerate_lesson(
      w3.req("reviewer-token", { lessonId: L4 }, { extra: 1 }),
    );
    expect(bad.status).toBe(400);
    expect((bad.body as Body).error?.code).toBe("INVALID_REQUEST");
  });

  it("with_optional_body: empty body becomes {}, malformed stays null", async () => {
    const mk = (text: string) =>
      new Request("https://app.example.test/x", { method: "POST", body: text });
    for (const [text, expected] of [
      ["", {}],
      ["  ", {}],
      ["{bad", null],
      ['{"note":"x"}', { note: "x" }],
    ] as const) {
      const raw = mk(text);
      const http = await to_http_request(raw.clone(), { lessonId: L4 });
      expect((await with_optional_body(raw, http)).body).toEqual(expected);
    }
  });
});
