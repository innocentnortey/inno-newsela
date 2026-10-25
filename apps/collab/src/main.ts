// Collab entry point (NL-07). Never log settings or Error messages (may carry secrets): names only.
import { pathToFileURL } from "node:url";
import { Server } from "@hocuspocus/server";
import { load_collab_settings, type CollabSettings } from "@ls/config/settings";
import { create_logger, type Logger } from "@ls/obs/logger";
import { write_start_event } from "./start-event.ts";
import { build_collab_deps } from "./deps.ts";
import type { CollabDeps } from "./deps-types.ts";
import { create_inflight_tracker, DrainingError, install_drain, type InflightTracker, type SignalHost } from "./drain.ts";
import { create_health_handler, is_health_path, open_health_db, type HealthDb } from "./health.ts";
import { handle_internal, is_internal_path } from "./commands/routes.ts";
import { wire_collab_server } from "./wiring/server.ts";
import { wire_collab_commands } from "./wiring/commands.ts";

export interface CollabRuntimeOptions {
  port?: number;
  health_db?: HealthDb;
  log_write?: (line: string) => void;
  exit?: (code: number) => void;
  signal_host?: SignalHost;
}
export interface CollabRuntime {
  settings: CollabSettings;
  deps: CollabDeps;
  server: Server;
  port: number;
  logger: Logger;
  tracker: InflightTracker;
  stop(): Promise<void>;
}

export async function build_collab_runtime(settings: CollabSettings, opts: CollabRuntimeOptions = {}): Promise<CollabRuntime> {
  const logger = create_logger({
    service: "collab",
    build_id: settings.shared.build_id,
    level: settings.shared.log_level,
    ...(opts.log_write ? { write: opts.log_write } : {}),
  });
  const deps = build_collab_deps(settings, logger);
  const tracker = create_inflight_tracker();
  const health_db: HealthDb = opts.health_db ?? open_health_db(settings);
  const healthz = create_health_handler(health_db, "collab", { build_id: settings.shared.build_id, logger });

  const server = new Server({
    port: opts.port ?? settings.collab_port,
    stopOnSignals: false,
    quiet: true,
    extensions: [],
    // Hocuspocus convention: write the response, then `throw null` to stop the default "Welcome" reply.
    async onRequest({ request, response }) {
      if (is_health_path(request.url, request.method)) {
        await healthz(request, response);
        throw null;
      }
      if (is_internal_path(request.url)) {
        try {
          await tracker.track(async () => handle_internal(request, response, logger));
        } catch (e) {
          if (!(e instanceof DrainingError)) throw e;
          response.writeHead(503, { "Content-Type": "application/json", Connection: "close" });
          response.end(
            JSON.stringify({ error: { code: "COLLAB_UNAVAILABLE", message: "The collaboration server is shutting down", details: {} } }),
          );
        }
        throw null;
      }
    },
  });
  const ref = { hocuspocus: server.hocuspocus };
  const sw = wire_collab_server(deps, ref);
  void wire_collab_commands(deps, sw, ref); // mounting is NL-80 / NL-105
  await server.listen();
  const port = server.address.port;
  logger.info("process.start", { extra: { port } });

  const real_exit = opts.exit ?? ((c: number) => process.exit(c));
  let finished!: () => void;
  const done = new Promise<void>((r) => (finished = r));
  const exit = (code: number): void => {
    real_exit(code);
    finished();
  };
  let fire: (() => void) | undefined;
  const upstream: SignalHost = opts.signal_host ?? process;
  const host: SignalHost = {
    on: (sig, fn) => {
      if (sig === "SIGTERM") fire = fn;
      return upstream.on(sig, fn);
    },
    off: (sig, fn) => upstream.off?.(sig, fn),
  };
  install_drain({ tracker, close: async () => {
      await server.destroy();
      if (!opts.health_db && "close" in health_db) await (health_db as { close(): Promise<void> }).close().catch(() => undefined);
    },
    exit, logger, host });
  return {
    settings, deps, server, port, logger, tracker,
    stop() {
      if (!tracker.draining) fire?.();
      return done;
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  build_collab_runtime(load_collab_settings(process.env))
    .then((rt) => {
      void write_start_event(rt.settings, rt.logger);
    })
    .catch((e) => {
    process.stderr.write(`collab failed to start: ${(e as Error).name}\n`);
    process.exit(1);
  });
}
