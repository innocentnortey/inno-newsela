// Starts the generation claim loop and the check lane (RT-1, closes S-8). Never log Error messages (may carry secrets): names only.
import type { WorkerSettings } from "@ls/config/settings";
import type { Logger } from "@ls/obs/logger";
import { DrainingError, type InflightTracker } from "./drain.ts";
import type { GenerationWiring } from "./wiring/generation.ts";
import type { CheckWiring } from "./wiring/checks.ts";

export interface LoopHost {
  tracker: InflightTracker;
  generation: GenerationWiring;
  checks: CheckWiring;
  logger: Logger;
  settings: WorkerSettings;
  exit: (code: number) => void;
}

export function start_worker_loops(h: LoopHost): { done: Promise<void> } {
  // The only stop condition is the drain, so the loops end exactly when install_drain begins.
  const stop = { is_set: () => h.tracker.draining };
  h.logger.info("worker.model_mode", {
    extra: {
      mode: h.settings.model.model_provider_mode,
      spend_ceiling_usd: h.settings.spend.build_spend_ceiling_usd.toString(),
      key_present: h.settings.model.anthropic_api_key !== null,
    },
  });
  const guard = (work: () => Promise<void>): Promise<void> =>
    h.tracker.track(work).catch((e: unknown) => {
      if (e instanceof DrainingError) return;
      h.logger.error("worker.loop_failed", { extra: { name: e instanceof Error ? e.name : "unknown" } });
      h.exit(1);
    });
  const generation = guard(async () => {
    // Orphan cleanup runs before any claim; the tracker counts the loop so the drain waits for the claimed job.
    await h.generation.claim_loop.start();
    const r = await h.generation.claim_loop.run_until(stop);
    if (r.reason === "fatal") throw new Error("claim_loop fatal");
  });
  const checks = guard(async () => {
    await h.checks.check_lane.run_until(stop);
  });
  return { done: Promise.all([generation, checks]).then(() => undefined) };
}
