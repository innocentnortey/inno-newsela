// Worker entry point (NL-07). Never log settings or Error messages (may carry secrets): names only.
import { pathToFileURL } from "node:url";
import { load_worker_settings, type WorkerSettings } from "@ls/config/settings";
import { create_logger, type Logger } from "@ls/obs/logger";
import { write_start_event } from "./start-event.ts";
import { build_worker_deps } from "./deps.ts";
import type { WorkerDeps } from "./deps-types.ts";
import { create_inflight_tracker, install_drain, type InflightTracker, type SignalHost } from "./drain.ts";
import { open_health_db, serve_health, type HealthDb, type HealthServer } from "./health.ts";
import { wire_generation, type GenerationWiring } from "./wiring/generation.ts";
import { wire_checks, type CheckWiring } from "./wiring/checks.ts";
import { wire_judge, type JudgeWiring } from "./wiring/judge.ts";

export interface WorkerRuntimeOptions {
  health_port?: number;
  health_db?: HealthDb;
  log_write?: (line: string) => void;
  exit?: (code: number) => void;
  signal_host?: SignalHost;
}
export interface WorkerRuntime {
  settings: WorkerSettings;
  deps: WorkerDeps;
  health: HealthServer;
  logger: Logger;
  generation: GenerationWiring;
  checks: CheckWiring;
  judge: JudgeWiring;
  tracker: InflightTracker;
  stop(): Promise<void>;
}

export async function build_worker_runtime(settings: WorkerSettings, opts: WorkerRuntimeOptions = {}): Promise<WorkerRuntime> {
  const logger = create_logger({
    service: "worker",
    build_id: settings.shared.build_id,
    level: settings.shared.log_level,
    ...(opts.log_write ? { write: opts.log_write } : {}),
  });
  const deps = build_worker_deps(settings, logger);
  const generation = wire_generation(deps);
  const checks = wire_checks(deps);
  const judge = wire_judge(deps);
  const health_db: HealthDb = opts.health_db ?? open_health_db(settings);
  const health = await serve_health(health_db, opts.health_port ?? 8081, "worker", { build_id: settings.shared.build_id, logger });
  logger.info("process.start", { extra: { worker_id: settings.worker_id } });
  const tracker = create_inflight_tracker();
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
      await health.close();
      if (!opts.health_db && "close" in health_db) await (health_db as { close(): Promise<void> }).close().catch(() => undefined);
    },
    exit, logger, host });
  return {
    settings, deps, health, logger, generation, checks, judge, tracker,
    stop() {
      if (!tracker.draining) fire?.();
      return done;
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  build_worker_runtime(load_worker_settings(process.env), { health_port: Number(process.env.WORKER_HEALTH_PORT ?? 8081) })
    .then((rt) => {
      void write_start_event(rt.settings, rt.logger);
    })
    .catch((e) => {
    process.stderr.write(`worker failed to start: ${(e as Error).name}\n`);
    process.exit(1);
  });
}
