// @vitest-environment node
// NL-34 AC-10: capture evidence for the list and for one logged refusal.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { make_deps } from "@/server/http/testing/route-fixtures.ts";
import { RoleResolver, get, seed, type Seeded } from "./harness.ts";

const h = vi.hoisted(() => ({ wr: null as null | ((...a: unknown[]) => unknown), svc: null as unknown, logger: null as unknown }));
vi.mock("@/server/http/with-route.ts", async (orig) => {
  const actual = await orig<typeof import("@/server/http/with-route.ts")>();
  return { ...actual, with_route: (...a: unknown[]) => h.wr!(...a) };
});
vi.mock("@/server/container.ts", () => ({ getServices: () => ({ prompts: h.svc, logger: h.logger }) }));

let s: Seeded;
let GET: (r: Request) => Promise<Response>;
let lines: string[];

beforeAll(async () => {
  s = await seed();
  const actual = await vi.importActual<typeof import("@/server/http/with-route.ts")>("@/server/http/with-route.ts");
  const d = make_deps({ sessions: () => new RoleResolver() });
  lines = d.lines;
  h.wr = actual.make_with_route(d.deps) as never;
  h.svc = s.service;
  GET = ((await import("./route.ts")) as { GET: typeof GET }).GET;
}, 60_000);
afterAll(async () => {
  await s.t.drop();
});

describe("prompt versions capture (NL-34 AC-10)", () => {
  it("list shows the pinned run and writes nothing", async () => {
    const pv = await s.count("prompt_version");
    const ae = await s.count("audit_event");
    const body = (await (await GET(get("/api/prompt-versions", "valid-token"))).json()) as {
      current_prompt_version_id: string;
      guidance_versions: { version_id: string; pinned_by_runs: string[] }[];
    };
    await GET(get("/api/prompt-versions", "valid-token"));
    expect(body.guidance_versions.find((g) => g.version_id === s.v1_id)!.pinned_by_runs).toEqual([s.run_id]);
    expect(body.current_prompt_version_id).toBe((await s.repo.current()).prompt_version_id);
    expect(await s.count("prompt_version")).toBe(pv);
    expect(await s.count("audit_event")).toBe(ae);
  });

  it("a refused read logs exactly one route.refused line with the request id", async () => {
    const { mint_request_id } = await vi.importActual<typeof import("@/server/http/with-route.ts")>("@/server/http/with-route.ts");
    const rid = mint_request_id();
    const res = await GET(get("/api/prompt-versions", null, { "x-request-id": rid }));
    expect(res.status).toBe(401);
    const hits = lines.filter((l) => l.includes("route.refused") && l.includes(rid));
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("UNAUTHENTICATED");
    console.log(hits[0]);
  });
});
