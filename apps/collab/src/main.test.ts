import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { load_collab_settings } from "@ls/config/settings";
import { build_collab_runtime } from "./main.ts";
import type { PgDatabase } from "@ls/db/pool";

const FAKE_DB = { ping: async () => true, with_tx: async () => { throw new Error("unused"); } } as unknown as PgDatabase;

function var_uint(n: number): number[] {
  const out: number[] = [];
  while (n > 127) {
    out.push(128 | (n & 127));
    n = Math.floor(n / 128);
  }
  out.push(n);
  return out;
}
function var_string(s: string): number[] {
  const b = new TextEncoder().encode(s);
  return [...var_uint(b.length), ...b];
}
function read_var_uint(a: Uint8Array, pos: number): [number, number] {
  let n = 0, mul = 1, p = pos;
  for (;;) {
    const b = a[p++] as number;
    n += (b & 127) * mul;
    mul *= 128;
    if (b < 128) return [n, p];
  }
}

describe("collab main", () => {
  it("starts_serves_websocket", async () => {
    const handlers = new Map<string, () => void>();
    const exit = vi.fn();
    const rt = await build_collab_runtime(
      load_collab_settings({ DATABASE_URL: "postgres://u:p@localhost:5432/d", COLLAB_INTERNAL_TOKEN: "t-collab" }),
      { port: 0, health_db: FAKE_DB, log_write: () => {}, exit, signal_host: { on: (s, f) => void handlers.set(s, f) } },
    );
    const health = await fetch(`http://127.0.0.1:${rt.port}/healthz`);
    expect(health.status).toBe(200);

    const doc = "lesson-test";
    const auth = Uint8Array.from([...var_string(doc), ...var_uint(2), ...var_uint(0), ...var_string("")]);
    const sv = Y.encodeStateVector(new Y.Doc());
    const sync = Uint8Array.from([...var_string(doc), ...var_uint(0), ...var_uint(0), ...var_uint(sv.length), ...sv]);

    const ws = new WebSocket(`ws://127.0.0.1:${rt.port}`);
    ws.binaryType = "arraybuffer";
    const reply = await new Promise<Uint8Array>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), 5000);
      ws.onopen = () => {
        ws.send(auth);
        ws.send(sync);
      };
      ws.onmessage = (e) => {
        const a = new Uint8Array(e.data as ArrayBuffer);
        const [len, p] = read_var_uint(a, 0);
        const name = new TextDecoder().decode(a.slice(p, p + len));
        if (name !== doc) return;
        const [type, q] = read_var_uint(a, p + len);
        if (type !== 0) return; // wait for a Sync frame
        const [sub] = read_var_uint(a, q);
        if (sub === 0 || sub === 1) {
          clearTimeout(t);
          resolve(a);
        }
      };
      ws.onerror = () => reject(new Error("ws error"));
    });
    expect(reply.length).toBeGreaterThan(0);
    ws.close();
    await rt.stop();
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  }, 15000);
});
