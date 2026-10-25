// @vitest-environment node
// NL-34 AC-3, AC-4, AC-5 against a real database through the real with_route.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PromptVersions } from "@ls/schema/api/prompts";
import { make_deps } from "@/server/http/testing/route-fixtures.ts";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PromptRenderer } from "@ls/prompts/render";
import { SchemaRegistry } from "@ls/prompts/schemas";
import { draft_input, syn1_row } from "@ls/prompts/testing/fixtures";
import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked";
import { diff_lines } from "@/server/services/guidance-diff.ts";
import { RoleResolver, get, post, seed, type Seeded } from "./harness.ts";

const h = vi.hoisted(() => ({ wr: null as null | ((...a: unknown[]) => unknown), svc: null as unknown, logger: null as unknown }));
vi.mock("@/server/http/with-route.ts", async (orig) => {
  const actual = await orig<typeof import("@/server/http/with-route.ts")>();
  return { ...actual, with_route: (...a: unknown[]) => h.wr!(...a) };
});
vi.mock("@/server/container.ts", () => ({ getServices: () => ({ prompts: h.svc, logger: h.logger }) }));

let s: Seeded;
let mod: Record<string, unknown> & { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let lines: string[];

beforeAll(async () => {
  s = await seed();
  const { make_with_route } = await vi.importActual<typeof import("@/server/http/with-route.ts")>("@/server/http/with-route.ts");
  const d = make_deps({ sessions: () => new RoleResolver() });
  lines = d.lines;
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

  it("no_locked_layer_write_path: GET and POST are the only exports", async () => {
    expect(Object.keys(mod)).toEqual(["GET", "POST"]);
    for (const m of ["PUT", "PATCH", "DELETE"]) expect(mod[m]).toBeUndefined();
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

const PATH = "/api/prompt-versions";
const body = async (r: Response) => (await r.json()) as Record<string, any>;
const save = async (text: string, reason = "why", token = "valid-token", extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) => {
  const base = await s.repo.current();
  return mod.POST(post(PATH, token, { base_version_id: base.prompt_version_id, guidance_text: text, reason, ...extra }, headers));
};

describe("POST /api/prompt-versions (NL-88)", () => {
  it("save_creates_v2_with_diff_and_reason", async () => {
    const base = await s.repo.current();
    const res = await save("line one\nline two", "  sharper  ");
    expect(res.status).toBe(201);
    const b = await body(res);
    expect(b["number"]).toBe(base.number + 1);
    expect(b["diff"]).toBe(diff_lines(base.guidance_text, "line one\nline two"));
    expect(b["reason"]).toBe("sharper");
    expect(b["author"]).toBe("Test author");
    expect(await s.repo.get(base.prompt_version_id)).toEqual(base);
    expect((await s.repo.get(b["version_id"]))!.guidance_text).toBe("line one\nline two");
  });

  it("reason_required_and_length_limit", async () => {
    const pv = await s.count("prompt_version");
    const ae = await s.count("audit_event");
    for (const r of ["", "   "]) {
      const res = await save("x", r);
      expect(res.status).toBe(422);
      expect((await body(res))["error"].code).toBe("REASON_REQUIRED");
    }
    const long = await save("a".repeat(8001));
    expect(long.status).toBe(400);
    const lb = await body(long);
    expect(lb["error"].code).toBe("INVALID_REQUEST");
    expect(lb["error"].details.fields).toContain("guidance_text");
    expect(await s.count("prompt_version")).toBe(pv);
    expect(await s.count("audit_event")).toBe(ae);
    expect((await save("a".repeat(8000))).status).toBe(201);
  });

  it("concurrent_saves_stale_base", async () => {
    const base = await s.repo.current();
    const pv = await s.count("prompt_version");
    const ae = await s.count("audit_event");
    const mk = (t: string) => mod.POST(post(PATH, "valid-token", { base_version_id: base.prompt_version_id, guidance_text: t, reason: "r" }));
    const rs = await Promise.all([mk("one"), mk("two")]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    const ok = await body(rs.find((r) => r.status === 201)!);
    const lost = await body(rs.find((r) => r.status === 409)!);
    expect(lost["error"].code).toBe("STALE_BASE");
    expect(lost["error"].details.latest_version_id).toBe(ok["version_id"]);
    expect(await s.count("prompt_version")).toBe(pv + 1);
    expect(await s.count("audit_event")).toBe(ae + 1);
    const again = await mod.POST(post(PATH, "valid-token", { base_version_id: base.prompt_version_id, guidance_text: "three", reason: "r" }));
    expect(again.status).toBe(409);
  });

  it.each([["reviewer-token"], ["approver-token"]])("role_forbidden_writes_nothing: %s", async (tok) => {
    const pv = await s.count("prompt_version");
    const ae = await s.count("audit_event");
    const res = await save("x", "r", tok);
    expect(res.status).toBe(403);
    expect((await body(res))["error"].code).toBe("ROLE_FORBIDDEN");
    expect(await s.count("prompt_version")).toBe(pv);
    expect(await s.count("audit_event")).toBe(ae);
  });

  it("locked_layer_untouchable", async () => {
    expect(Object.keys(mod)).toEqual(["GET", "POST"]);
    for (const m of ["PUT", "PATCH", "DELETE"]) expect(mod[m]).toBeUndefined();
    const pv = await s.count("prompt_version");
    for (const key of ["locked_text", "locked_hash"]) {
      const res = await save("x", "r", "valid-token", { [key]: "x" });
      expect(res.status).toBe(400);
      const b = await body(res);
      expect(b["error"].code).toBe("INVALID_REQUEST");
      expect(b["error"].details.fields).toContain(key);
    }
    expect(await s.count("prompt_version")).toBe(pv);
    const root = join(process.cwd(), "apps/web/app/api");
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name === "route.ts" ? [join(d, e.name)] : []));
    const routes = walk(root);
    expect(routes.length).toBeGreaterThan(3);
    for (const f of routes) {
      const text = readFileSync(f, "utf8");
      for (const w of ["sync_locked_layer", "locked_text", "locked_hash"]) expect(text, f + " mentions " + w).not.toContain(w);
    }
    const saved = await body(await save("fine", "r"));
    const v = (await s.repo.get(saved["version_id"]))!;
    expect(v.locked_hash).toBe((await s.repo.get(s.v1_id))!.locked_hash);
    expect(v.locked_hash).toBe(locked_hash(LOCKED_DIR));
  });

  it("audit_event_per_save", async () => {
    const base = await s.repo.current();
    const ae = await s.count("audit_event");
    const b = await body(await save("audited", "because"));
    expect(await s.count("audit_event")).toBe(ae + 1);
    const rows = await s.t.db.with_tx(
      async (tx) =>
        (await tx.query<Record<string, any>>("select actor_id, target_kind, target_id, reason, at, details_json->>'base_version_id' as base from audit_event where action='prompt.save_guidance' and target_id=$1", [b["version_id"]])).rows,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: "usr_synthetic_author", target_kind: "prompt_version", reason: "because", base: base.prompt_version_id });
    expect(rows[0]!["at"]).not.toBeNull();
    expect(b["author"]).toBe("Test author");
    expect(Number.isNaN(Date.parse(b["created_at"]))).toBe(false);
  });

  it("guidance_is_data_not_logged", async () => {
    const text = "note sk-ant-SYNTHETIC-KEY-MARKER-0001 and RESTRICTED-CONTENT-MARKER-0002";
    const res = await save(text, "markers");
    expect(res.status).toBe(201);
    const b = await body(res);
    for (const l of lines) {
      expect(l).not.toContain("SYNTHETIC-KEY-MARKER-0001");
      expect(l).not.toContain("RESTRICTED-CONTENT-MARKER-0002");
    }
    const row = (await s.repo.get(b["version_id"]))!;
    const r = new PromptRenderer(LOCKED_DIR, new SchemaRegistry()).render_lesson_draft({ ...draft_input(syn1_row()), prompt: row } as never);
    expect(r.text.indexOf("### locked")).toBeLessThan(r.text.indexOf("### guidance"));
    const g = r.system_blocks.find((x) => x.label === "guidance")!;
    expect(g.text).toContain("SYNTHETIC-KEY-MARKER-0001");
    expect(g.text).toContain("RESTRICTED-CONTENT-MARKER-0002");
    for (const x of r.system_blocks.filter((y) => y.label === "locked")) {
      expect(x.text).not.toContain("MARKER-0001");
      expect(x.text).not.toContain("MARKER-0002");
    }
  });

  it("test_prompt_version_capture", async () => {
    const { mint_request_id } = await vi.importActual<typeof import("@/server/http/with-route.ts")>("@/server/http/with-route.ts");
    const base = await s.repo.current();
    const ok = await body(await save("captured\ntext", "capture reason"));
    expect(ok["number"]).toBe(base.number + 1);
    expect(ok["diff"]).toBe(diff_lines(base.guidance_text, "captured\ntext"));
    expect(ok["reason"]).toBe("capture reason");
    const pinned = await s.t.db.with_tx(async (tx) => (await tx.query<{ prompt_version_id: string }>("select prompt_version_id from run where id=$1", [s.run_id])).rows[0]!.prompt_version_id);
    expect(pinned).toBe(s.v1_id);
    const list = await body(await mod.GET(get(PATH, "valid-token")));
    expect(list["guidance_versions"].find((g: any) => g.version_id === s.v1_id).pinned_by_runs).toContain(s.run_id);

    const pv = await s.count("prompt_version");
    const rid = mint_request_id();
    const res = await save("zzz", "", "valid-token", {}, { "x-request-id": rid });
    expect(res.status).toBe(422);
    expect(await s.count("prompt_version")).toBe(pv);
    const hits = lines.filter((l) => l.includes("route.refused") && l.includes(rid));
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("REASON_REQUIRED");
    console.log(hits[0]);
  });
});
