import { describe, expect, it, vi } from "vitest";
import { load_worker_settings } from "@ls/config/settings";
import { build_worker_runtime } from "./main.ts";
import type { PgDatabase } from "@ls/db/pool";

const FAKE_DB = { ping: async () => true, with_tx: async () => { throw new Error("unused"); } } as unknown as PgDatabase;

const ENV = { DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t-collab" };

describe("worker main", () => {
  it("starts_serves_drains", async () => {
    const lines: string[] = [];
    const handlers = new Map<string, () => void>();
    const exit = vi.fn();
    const rt = await build_worker_runtime(load_worker_settings(ENV), {
      health_port: 0,
      health_db: FAKE_DB,
      log_write: (l) => lines.push(l),
      exit,
      signal_host: { on: (s, fn) => void handlers.set(s, fn) },
    });
    const starts = lines.map((l) => JSON.parse(l)).filter((l) => l.event === "process.start");
    expect(starts).toHaveLength(1);
    expect(starts[0].service).toBe("worker");
    expect(starts[0].build_id).toBeTruthy();
    const res = await fetch(`http://127.0.0.1:${rt.health.port}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", service: "worker", build_id: rt.settings.shared.build_id });
    handlers.get("SIGTERM")?.();
    await rt.stop();
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    await expect(fetch(`http://127.0.0.1:${rt.health.port}/healthz`)).rejects.toThrow();
  });
});
