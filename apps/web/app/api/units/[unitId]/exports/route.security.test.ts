// NL-51 frozen security test (AC-7) through the real with_route and handler factory. Do not edit.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { RequestUser } from "@ls/core/ports/common";
import { canonical_json } from "@ls/schema/content-hash";
import { DomainRefusal, APP_ORIGIN, make_deps } from "@/server/http/testing/route-fixtures.ts";
import { make_with_route, type HttpRequest, type SessionResolver } from "@/server/http/with-route.ts";
import { make_export_handlers, type ExportApi } from "../../../exports/http.ts";
import { make_service, make_world, user, UNIT } from "@/server/services/export-fixtures.ts";

class Roles implements SessionResolver {
  async require(token: string | null, request_id: string): Promise<RequestUser> {
    if (token === "approver-token") return { ...user("approver"), request_id };
    if (token === "author-token") return { ...user("author"), request_id };
    if (token === "reviewer-token") return { ...user("reviewer"), request_id };
    throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
  }
}

function setup() {
  const w = make_world();
  w.seed("G6.U4.L5", "approved");
  w.seed("G6.U4.L4", "approved");
  const svc = make_service(w);
  const { deps } = make_deps({ sessions: () => new Roles() });
  const h = make_export_handlers({ with_route: make_with_route(deps), exports: () => svc as unknown as ExportApi });
  const req = (method: string, params: Record<string, string>, token: string | null): HttpRequest => ({
    method,
    path_params: params,
    query: {},
    headers: method === "POST" ? { origin: APP_ORIGIN } : {},
    body: null,
    cookies: token === null ? {} : { ls_session: token },
  });
  return { w, h, req };
}

const sha = (v: unknown) => createHash("sha256").update(canonical_json(v), "utf8").digest("hex");
const code = (r: { body: unknown }) => (r.body as { error: { code: string } }).error.code;

describe("AC-7 roles_notfound_download [failure/refusal]", () => {
  it("roles_notfound_download: author and reviewer get 403 on all three routes and nothing is written", async () => {
    const { w, h, req } = setup();
    const made = await h.create_export(req("POST", { unitId: UNIT }, "approver-token"));
    expect(made.status).toBe(201);
    const export_id = (made.body as { export_id: string }).export_id;
    const before = w.snapshot();
    for (const token of ["author-token", "reviewer-token"]) {
      const l = await h.list_exports(req("GET", { unitId: UNIT }, token));
      const c = await h.create_export(req("POST", { unitId: UNIT }, token));
      const d = await h.download_export(req("GET", { exportId: export_id }, token));
      for (const r of [l, c, d]) {
        expect(r.status).toBe(403);
        expect(code(r)).toBe("ROLE_FORBIDDEN");
      }
    }
    expect(w.snapshot()).toEqual(before);
  });

  it("roles_notfound_download: no session is 401 and writes nothing", async () => {
    const { w, h, req } = setup();
    const r = await h.create_export(req("POST", { unitId: UNIT }, null));
    expect(r.status).toBe(401);
    expect(w.writes()).toBe(0);
  });

  it("roles_notfound_download: unknown unit and unknown export id are 404", async () => {
    const { w, h, req } = setup();
    const a = await h.list_exports(req("GET", { unitId: "G9.U9" }, "approver-token"));
    const b = await h.create_export(req("POST", { unitId: "G9.U9" }, "approver-token"));
    const c = await h.download_export(req("GET", { exportId: "exp_" + "0".repeat(26) }, "approver-token"));
    for (const r of [a, b, c]) {
      expect(r.status).toBe(404);
      expect(code(r)).toBe("NOT_FOUND");
    }
    expect(w.writes()).toBe(0);
  });

  it("roles_notfound_download: download returns the stored payload byte-for-byte (hash equals payload_hash)", async () => {
    const { w, h, req } = setup();
    const made = await h.create_export(req("POST", { unitId: UNIT }, "approver-token"));
    const export_id = (made.body as { export_id: string }).export_id;
    const listed = await h.list_exports(req("GET", { unitId: UNIT }, "approver-token"));
    expect(listed.status).toBe(200);
    const entry = (listed.body as { exports: Array<{ export_id: string; payload_hash: string }> }).exports.find((e) => e.export_id === export_id);
    expect(entry).toBeDefined();
    const dl = await h.download_export(req("GET", { exportId: export_id }, "approver-token"));
    expect(dl.status).toBe(200);
    expect(sha(dl.body)).toBe(entry!.payload_hash);
    expect(dl.body).toEqual(w.payloads.get(export_id));
  });

  it("roles_notfound_download: the second createExport with no change answers 200 and writes nothing", async () => {
    const { w, h, req } = setup();
    const first = await h.create_export(req("POST", { unitId: UNIT }, "approver-token"));
    expect(first.status).toBe(201);
    const before = w.snapshot();
    const second = await h.create_export(req("POST", { unitId: UNIT }, "approver-token"));
    expect(second.status).toBe(200);
    expect((second.body as { same_as_previous: boolean }).same_as_previous).toBe(true);
    expect(w.snapshot()).toEqual(before);
  });
});
