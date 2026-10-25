import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { load_collab_settings } from "@ls/config/settings";
import { build_collab_runtime, type CollabRuntime } from "../main.ts";

const TOKEN = "t-collab";
let rt: CollabRuntime;
const lines: string[] = [];

beforeAll(async () => {
  rt = await build_collab_runtime(load_collab_settings({ DATABASE_URL: "postgres://u:p@localhost:5432/d", COLLAB_INTERNAL_TOKEN: TOKEN }), {
    port: 0,
    log_write: (l) => lines.push(l),
    exit: vi.fn(),
    signal_host: { on: () => {} },
  });
});
afterAll(async () => {
  await rt.stop();
});

describe("/internal shell", () => {
  it.each([
    ["no token", {}],
    ["bad token", { Authorization: "Bearer wrong" }],
    ["good token", { Authorization: `Bearer ${TOKEN}` }],
  ])("503 with %s", async (_n, headers) => {
    for (const method of ["POST", "GET", "PUT"]) {
      const before = lines.filter((l) => l.includes("internal.not_built")).length;
      const res = await fetch(`http://127.0.0.1:${rt.port}/internal/lessons/x/edit`, { method, headers });
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("COLLAB_UNAVAILABLE");
      expect(lines.filter((l) => l.includes("internal.not_built")).length).toBe(before + 1);
    }
    expect(lines.join("\n")).not.toContain(TOKEN);
    expect(lines.join("\n")).not.toContain("wrong");
  });

  it("healthz is exactly status ok", async () => {
    const res = await fetch(`http://127.0.0.1:${rt.port}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"status":"ok"}');
  });
});
