// GEN-6 frozen tests: the three Lows from the seam audit (commands wiring close, startup cleanup, no db stub in deps).
// Written before the implementation. Nothing here needs a database.
import { afterEach, describe, expect, it, vi } from "vitest";
import { load_collab_settings } from "@ls/config/settings";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { PgDatabase } from "@ls/db/pool";
import { SystemClock } from "@ls/core/ports/clock";
import { AckBroadcaster } from "./acks.ts";
import { FrozenDocs } from "./frozen-docs.ts";
import { install_command_handler } from "./commands/routes.ts";
import { FakeDocStore, FakeReader, FakeStates, capture_logger, clock, settings } from "./nl-80.fixtures.ts";
import { FakeStandards, FakeVersions, LESSON, TOKEN, bearer, http_harness, mode_body } from "./commands/nl-105.fixtures.ts";
import type { CollabDeps } from "./deps-types.ts";

const FAKE_DB = { ping: async () => true, with_tx: async () => { throw new Error("unused"); } } as unknown as PgDatabase;
const SETTINGS = () => load_collab_settings({ DATABASE_URL: "postgres://u:p@localhost:5432/d", COLLAB_INTERNAL_TOKEN: "t-collab" });

const wiring_spies = vi.hoisted(() => ({ mode: "real" as "real" | "throw" | "fake", close: undefined as undefined | (() => Promise<void>), sw_close: undefined as undefined | ReturnType<typeof vi.fn> }));

vi.mock("./wiring/commands.ts", async (importActual) => {
  const actual = await importActual<typeof import("./wiring/commands.ts")>();
  return {
    ...actual,
    wire_collab_commands: (...args: Parameters<typeof actual.wire_collab_commands>) => {
      if (wiring_spies.mode === "throw") throw new Error("BOOM-GEN6");
      if (wiring_spies.mode === "fake") return { handler: {} as never, close: wiring_spies.close! };
      return actual.wire_collab_commands(...args);
    },
  };
});
vi.mock("./wiring/server.ts", async (importActual) => {
  const actual = await importActual<typeof import("./wiring/server.ts")>();
  return {
    ...actual,
    wire_collab_server: (...args: Parameters<typeof actual.wire_collab_server>) => {
      const w = actual.wire_collab_server(...args);
      const real_close = w.close.bind(w);
      wiring_spies.sw_close = vi.fn(real_close);
      return { ...w, close: wiring_spies.sw_close as () => Promise<void> };
    },
  };
});

afterEach(() => {
  install_command_handler(null);
  wiring_spies.mode = "real";
  wiring_spies.close = undefined;
  wiring_spies.sw_close = undefined;
});

const deps = () => ({ settings: settings(), logger: capture_logger().logger, db: {} as never, ids: new PrefixedIdGenerator(), clock: clock() });
const sw = () => ({ frozen: new FrozenDocs(), acks: new AckBroadcaster({ sockets_of: () => [], find: () => undefined }), persistence: {} as never }) as never;

describe("GEN-6 Low 1: the commands wiring can be closed", () => {
  it("L-1 close() is a function; after it the installed handler is gone and the pool is closed; a second close() does not throw", async () => {
    const { wire_collab_commands } = await vi.importActual<typeof import("./wiring/commands.ts")>("./wiring/commands.ts");
    const w = wire_collab_commands(deps(), sw(), { hocuspocus: null }, {
      states: new FakeStates("in_review"), store: new FakeDocStore(), reader: new FakeReader(), versions: new FakeVersions() as never, standards: new FakeStandards() as never,
    });
    expect(typeof (w as { close?: unknown }).close).toBe("function");
    const http = await http_harness(capture_logger().logger);
    try {
      const before = await http.post(LESSON, "set-mode", mode_body({ mode: "editable", state: "in_review" }), bearer());
      expect(before.status).toBe(200);
      await w.close();
      const after = await http.post(LESSON, "set-mode", mode_body({ mode: "editable", state: "in_review" }), bearer());
      expect(after.status).not.toBe(200);
      expect(TOKEN.length).toBeGreaterThan(0);
    } finally {
      await http.close();
    }
    await expect(w.close()).resolves.toBeUndefined();
  });
});

describe("GEN-6 Low 2: startup and drain", () => {
  it("L-2 when the commands wiring throws, startup fails with that error, the server wiring is closed once, and nothing started listening", async () => {
    wiring_spies.mode = "throw";
    const { build_collab_runtime } = await import("./main.ts");
    const lines: string[] = [];
    const exit = vi.fn();
    await expect(
      build_collab_runtime(SETTINGS(), { port: 0, health_db: FAKE_DB, log_write: (l) => void lines.push(l), exit, signal_host: { on: () => undefined } }),
    ).rejects.toThrow("BOOM-GEN6");
    expect(wiring_spies.sw_close).toHaveBeenCalledOnce();
    expect(lines.some((l) => l.includes("process.start"))).toBe(false);
    expect(exit).not.toHaveBeenCalled();
  }, 15000);

  it("L-3 drain closes the commands wiring (its database pool) exactly once", async () => {
    const close = vi.fn(async () => undefined);
    wiring_spies.mode = "fake";
    wiring_spies.close = close;
    const { build_collab_runtime } = await import("./main.ts");
    const handlers = new Map<string, () => void>();
    const exit = vi.fn();
    const rt = await build_collab_runtime(SETTINGS(), {
      port: 0, health_db: FAKE_DB, log_write: () => {}, exit, signal_host: { on: (s, f) => void handlers.set(s, f) },
    });
    expect(close).not.toHaveBeenCalled();
    await rt.stop();
    expect(close).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  }, 15000);

  it("L-3b [negative] a commands close() that rejects does not stop the drain from exiting 0", async () => {
    wiring_spies.mode = "fake";
    wiring_spies.close = vi.fn(async () => { throw new Error("pool close failed"); });
    const { build_collab_runtime } = await import("./main.ts");
    const exit = vi.fn();
    const rt = await build_collab_runtime(SETTINGS(), {
      port: 0, health_db: FAKE_DB, log_write: () => {}, exit, signal_host: { on: () => undefined },
    });
    await rt.stop();
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  }, 15000);
});

describe("GEN-6 Low 3: no unbuilt db stub in the collab deps", () => {
  it("L-4 build_collab_deps carries no db property and still has settings, logger, ids and clock; frozen literals with db still typecheck", async () => {
    const { build_collab_deps } = await import("./deps.ts");
    const logger = capture_logger().logger;
    const d = build_collab_deps(settings(), logger);
    expect("db" in d).toBe(false);
    expect(d.settings).toBeDefined();
    expect(d.logger).toBe(logger);
    expect(d.ids).toBeDefined();
    expect(d.clock).toBeDefined();
    // Compile-time pin: a literal that still names `db` (as the frozen NL-80/NL-105 tests do) must stay assignable.
    const pinned: CollabDeps = { settings: settings(), logger, db: undefined as never, ids: new PrefixedIdGenerator(), clock: new SystemClock() };
    expect(pinned.ids).toBeDefined();
  });
});
