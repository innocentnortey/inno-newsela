// NL-80 frozen tests: AC-11, AC-12 (wiring half). Written before the implementation.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { load_collab_settings } from "@ls/config/settings";
import { build_collab_runtime } from "../main.ts";
import type { PgDatabase } from "@ls/db/pool";
import { wire_collab_server } from "./server.ts";
import { DOC_NAME, FakeDocStore, FakeDocument, FakeReader, FakeSessions, FakeStates, capture_logger, clock, edited, settings, stored_doc, user } from "../nl-80.fixtures.ts";

// NL-83 made /healthz ping the database; this test has no database, so it injects a pinging fake (same as main.test.ts).
const FAKE_DB = { ping: async () => true, with_tx: async () => { throw new Error("unused"); } } as unknown as PgDatabase;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith(".fixtures.ts") ? [p] : [];
  });
}

describe("wire_server_builds_all_parts [invariant, AC-12]", () => {
  it("builds every part, mounts one extension, and applies the debounce settings", () => {
    const hocus = { configuration: { extensions: [] as unknown[], debounce: 0, maxDebounce: 0 }, documents: new Map() };
    const s = settings();
    const w = wire_collab_server(
      { settings: s, logger: capture_logger().logger, db: {} as never, ids: {} as never, clock: clock() },
      { hocuspocus: hocus },
      { sessions: new FakeSessions(), states: new FakeStates(), doc_store: new FakeDocStore(), doc_reader: new FakeReader() },
    );
    for (const k of ["frozen", "guard", "authenticator", "persistence", "acks", "extension", "close"] as const) expect(w[k], k).toBeDefined();
    expect(typeof w.close).toBe("function");
    expect(hocus.configuration.extensions).toHaveLength(1);
    expect(hocus.configuration.extensions[0]).toBe(w.extension);
    expect(hocus.configuration.debounce).toBe(2000);
    expect(hocus.configuration.maxDebounce).toBe(4000);
  });

  it("the extension exposes onChange, and onChange then onStoreDocument logs collab.stored with a store_wait_ms [GEN-4]", async () => {
    const hocus = { configuration: { extensions: [] as unknown[], debounce: 0, maxDebounce: 0 }, documents: new Map() };
    const cap = capture_logger();
    const w = wire_collab_server(
      { settings: settings(), logger: cap.logger, db: {} as never, ids: {} as never, clock: clock() },
      { hocuspocus: hocus },
      { sessions: new FakeSessions(), states: new FakeStates(), doc_store: new FakeDocStore(), doc_reader: new FakeReader(stored_doc()) },
    );
    const hooks = w.extension as unknown as Record<string, (p: unknown) => Promise<unknown>>;
    expect(typeof hooks["onChange"]).toBe("function");
    const doc = new FakeDocument([]);
    await hooks["onLoadDocument"]!({ document: doc, documentName: DOC_NAME });
    doc.getMap("front_matter").set("title", edited(3).title);
    await hooks["onChange"]!({ document: doc, documentName: DOC_NAME });
    await hooks["onStoreDocument"]!({ document: doc, documentName: DOC_NAME, lastContext: { ctx: { user: user("reviewer", "u-rev-9") } } });
    const stored = cap.lines.map((l) => JSON.parse(l) as { event: string; extra: Record<string, unknown> }).filter((o) => o.event === "collab.stored");
    expect(stored).toHaveLength(1);
    expect(typeof stored[0]!.extra["store_wait_ms"]).toBe("number");
  });

  it("[boundary] with no server to mount on (hocuspocus null) it still builds and mounts nothing", () => {
    const w = wire_collab_server(
      { settings: settings(), logger: capture_logger().logger, db: {} as never, ids: {} as never, clock: clock() },
      { hocuspocus: null },
      { sessions: new FakeSessions(), states: new FakeStates(), doc_store: new FakeDocStore(), doc_reader: new FakeReader() },
    );
    expect(w.extension).toBeDefined();
  });
});

describe("starts_without_provider_keys [invariant, AC-11]", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("settings parse and the process starts and stops with both provider keys unset", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["OPENROUTER_API_KEY"];
    const exit = vi.fn();
    const rt = await build_collab_runtime(
      load_collab_settings({ DATABASE_URL: "postgres://u:p@localhost:5432/d", COLLAB_INTERNAL_TOKEN: "t-collab" }),
      { port: 0, health_db: FAKE_DB, log_write: () => {}, exit, signal_host: { on: () => {} } },
    );
    expect((await fetch(`http://127.0.0.1:${rt.port}/healthz`)).status).toBe(200);
    await rt.stop();
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  }, 15000);

  it("no collab source imports a model client or names a provider key", () => {
    const root = new URL("..", import.meta.url).pathname;
    const sources = files(root);
    expect(sources.some((f) => f.endsWith("wiring/server.ts"))).toBe(true);
    for (const f of sources) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/@ls\/llm|anthropic|openai|ANTHROPIC_API_KEY|OPENROUTER_API_KEY/i);
    }
    // the five new modules exist (a stub shell would not satisfy the wiring test above)
    for (const m of ["auth", "permissions", "persistence", "acks", "frozen-docs"]) {
      expect(sources.some((f) => f.endsWith(`/${m}.ts`)), m).toBe(true);
    }
  });
});
