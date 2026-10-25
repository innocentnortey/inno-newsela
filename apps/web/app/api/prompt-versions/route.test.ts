// @vitest-environment node
// NL-34 AC-3, AC-4, AC-5 against a real database through the real with_route.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PromptVersions } from "@ls/schema/api/prompts";
import { make_deps } from "@/server/http/testing/route-fixtures.ts";
import { RoleResolver, get, seed, type Seeded } from "./harness.ts";

const h = vi.hoisted(() => ({ wr: null as null | ((...a: unknown[]) => unknown), svc: null as unknown, logger: null as unknown }));
vi.mock("@/server/http/with-route.ts", async (orig) => {
  const actual = await orig<typeof import("@/server/http/with-route.ts")>();
  return { ...actual, with_route: (...a: unknown[]) => h.wr!(...a) };
});
vi.mock("@/server/container.ts", () => ({ getServices: () => ({ prompts: h.svc, logger: h.logger }) }));

let s: Seeded;
let mod: Record<string, unknown> & { GET: (r: Request) => Promise<Response> };

beforeAll(async () => {
  s = await seed();
  const { make_with_route } = await vi.importActual<typeof import("@/server/http/with-route.ts")>("@/server/http/with-route.ts");
  const d = make_deps({ sessions: () => new RoleResolver() });
  h.wr = make_with_route(d.deps) as never;
  h.svc = s.service;
  h.logger = d.deps.logger;
  mod = (await import("./route.ts")) as never;
}, 60_000);
afterAll(async () => {
  await s.t.drop();
});

describe("GET /api/prompt-versions (NL-34)", () => {
  it("list_shape_and_pins", async () => {
    const res = await mod.GET(get("/api/prompt-versions", "valid-token"));
    expect(res.status).toBe(200);
    const body = PromptVersions.parse(await res.json());
    expect(body.current_prompt_version_id).toBe(s.v2_id);
    expect(body.locked_layer.version_id).toMatch(/^locked-[0-9a-f]{12}$/);
    expect(body.locked_layer.text.length).toBeGreaterThan(0);
    expect(body.guidance_versions.map((g) => g.number)).toEqual([1, 2]);
    expect(body.guidance_versions[0]).toMatchObject({ version_id: s.v1_id, author: "system", pinned_by_runs: [s.run_id] });
    expect(body.guidance_versions[1]).toMatchObject({ version_id: s.v2_id, author: "Test author", reason: "tighten", pinned_by_runs: [] });
  });

  it.each([["valid-token"], ["reviewer-token"], ["approver-token"]])("roles_and_read_only: %s gets 200", async (tok) => {
    const before = await s.count("prompt_version");
    expect((await mod.GET(get("/api/prompt-versions", tok))).status).toBe(200);
    expect(await s.count("prompt_version")).toBe(before);
  });

  it("roles_and_read_only: no session is 401 UNAUTHENTICATED", async () => {
    const res = await mod.GET(get("/api/prompt-versions", null));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
  });

  it("no_locked_layer_write_path: GET is the only export", async () => {
    expect(Object.keys(mod)).toEqual(["GET"]);
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) expect(mod[m]).toBeUndefined();
  });

  it("no_locked_layer_write_path: a GET carrying a locked_layer parameter changes nothing", async () => {
    const before = await s.count("prompt_version");
    const req = new Request("https://app.example.test/api/prompt-versions?locked_layer=x", {
      method: "GET",
      headers: { cookie: "ls_session=valid-token" },
    });
    expect((await mod.GET(req)).status).toBe(200);
    expect(await s.count("prompt_version")).toBe(before);
  });
});
