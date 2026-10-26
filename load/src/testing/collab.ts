// NL-119b test helper: a real Hocuspocus collaboration server on a free port, wired to a TestDb.
// Duplicated on purpose from apps/collab tests (tools do not import each other); importing the wiring here is the same pattern.
import { Server } from "@hocuspocus/server";
import { load_collab_settings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { PgDatabase } from "@ls/db/pool";
import { settings_for } from "@ls/db/testing/test-db";
import { create_logger } from "@ls/obs/logger";
import { wire_collab_server } from "../../../apps/collab/src/wiring/server.ts";

export interface CollabHarness {
  url: string;
  server: Server;
  stop(): Promise<void>;
}

export async function start_collab(
  t: { db: PgDatabase; url: string },
  over: { store_debounce_ms?: number; store_max_debounce_ms?: number } = {},
): Promise<CollabHarness> {
  const ids = new PrefixedIdGenerator();
  const clock = new SystemClock();
  const logger = create_logger({ service: "collab", build_id: "test", write: () => undefined });
  const base = load_collab_settings({ DATABASE_URL: t.url, COLLAB_INTERNAL_TOKEN: "t-collab", SESSION_COOKIE_NAME: "ls_session" });
  const settings = {
    ...base,
    shared: settings_for(t.url, 4),
    store_debounce_ms: over.store_debounce_ms ?? 500,
    store_max_debounce_ms: over.store_max_debounce_ms ?? 1000,
  };
  const server = new Server({ port: 0, quiet: true, stopOnSignals: false, extensions: [] });
  const wiring = wire_collab_server({ settings, logger, db: t.db as never, ids, clock }, { hocuspocus: server.hocuspocus });
  await server.listen();
  let stopped = false;
  return {
    url: `ws://127.0.0.1:${server.address.port}`,
    server,
    async stop() {
      if (stopped) return;
      stopped = true;
      await server.destroy().catch(() => undefined);
      await wiring.close();
    },
  };
}
