import "server-only";
import { ConfigError } from "@ls/config/errors";
import { load_web_settings, type WebSettings } from "@ls/config/settings";
import { create_logger, type Logger } from "@ls/obs/logger";
import { PgDatabase as RealPgDatabase } from "@ls/db/pool";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { SystemClock } from "@ls/core/ports/clock";
import type { WebDeps } from "./deps.ts";
import type { Clock, IdGenerator, ModelClient, PgDatabase } from "./deps-types.ts";
import { wire_assist, type AssistWiring } from "./wiring/assist.ts";
import { wire_coverage, type CoverageWiring } from "./wiring/coverage.ts";
import { wire_exports, type ExportWiring } from "./wiring/exports.ts";
import { wire_metrics, type MetricsWiring } from "./wiring/metrics.ts";
import { wire_outlines, type OutlineWiring } from "./wiring/outlines.ts";
import { wire_prompts, type PromptWiring } from "./wiring/prompts.ts";
import { wire_review, type ReviewWiring } from "./wiring/review.ts";
import { wire_runs, type RunWiring } from "./wiring/runs.ts";
import { wire_sessions, type SessionWiring } from "./wiring/sessions.ts";

export const SERVICES_KEY = Symbol.for("ls.web.services");

export type WebServices = SessionWiring &
  OutlineWiring &
  RunWiring &
  ReviewWiring &
  MetricsWiring &
  AssistWiring &
  PromptWiring &
  ExportWiring &
  CoverageWiring & { logger: Logger };

// Which ticket fills each service slot; reading an unset slot fails loudly with it.
const OWNER: Record<string, string> = {
  sessions: "NL-25",
  outlines: "NL-26",
  runs: "NL-78",
  lesson_reads: "NL-53",
  issues: "NL-53",
  slots: "NL-53",
  candidates: "NL-53",
  transitions: "NL-53",
  approvals: "NL-53",
  board: "NL-54",
  heartbeats: "NL-54",
  suggestions: "NL-116",
  prompts: "NL-34",
  exports: "NL-102",
  coverage: "NL-91",
};

function unbuilt<T extends object>(owner: string, members: string[]): T {
  const out: Record<string, unknown> = {};
  for (const m of members) {
    out[m] = () => {
      throw new Error("NOT BUILT: " + owner);
    };
  }
  return out as T;
}

export function build_web_services(settings: WebSettings): WebServices {
  const g = globalThis as unknown as Record<symbol, WebServices | undefined>;
  const cached = g[SERVICES_KEY];
  if (cached !== undefined) return cached;

  if (settings.model.model_provider_mode === "real") {
    if (settings.model.anthropic_api_key === null) {
      throw new ConfigError("ANTHROPIC_API_KEY", "required when MODEL_PROVIDER_MODE=real");
    }
    throw new ConfigError("MODEL_PROVIDER_MODE", "NOT BUILT: NL-32");
  }

  const logger = create_logger({
    service: "web",
    build_id: settings.shared.build_id,
    level: settings.shared.log_level,
  });
  // NL-12 swaps these for the real database, PrefixedIdGenerator, SystemClock and StubModelClient.
  const deps: WebDeps = {
    settings,
    logger,
    db: new RealPgDatabase(settings.shared, settings.shared.pg_pool_max, settings.pg_acquire_timeout_ms),
    ids: new PrefixedIdGenerator(),
    clock: new SystemClock(),
    model_client: unbuilt<ModelClient>("NL-12", ["complete"]),
  };

  // DO-3 section 8 order.
  const merged: WebServices = {
    ...wire_sessions(deps),
    ...wire_outlines(deps),
    ...wire_runs(deps),
    ...wire_review(deps),
    ...wire_metrics(deps),
    ...wire_assist(deps),
    ...wire_prompts(deps),
    ...wire_exports(deps),
    ...wire_coverage(deps),
    logger,
  };
  const services = new Proxy(merged, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver) as unknown;
      if (typeof key === "string" && Object.hasOwn(OWNER, key) && value === undefined) {
        throw new Error("NOT BUILT: " + OWNER[key]);
      }
      return value;
    },
  });
  g[SERVICES_KEY] = services;
  return services;
}

export function getServices(): WebServices {
  return build_web_services(load_web_settings(process.env));
}
