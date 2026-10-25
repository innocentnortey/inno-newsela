// Starts the generation claim loop and the check lane (RT-1, closes S-8). Never log Error messages (may carry secrets): names only.
import type { WorkerSettings } from "@ls/config/settings";
import type { Logger } from "@ls/obs/logger";
import { DrainingError, type InflightTracker } from "./drain.ts";
import type { GenerationWiring } from "./wiring/generation.ts";
import type { CheckWiring } from "./wiring/checks.ts";
import type { JudgeWiring } from "./wiring/judge.ts";

export interface LoopHost {
  tracker: InflightTracker;
  generation: GenerationWiring;
  checks: CheckWiring;
  judge?: JudgeWiring; // optional: the evals child host and older test hosts start no judge lane
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
    // A database that is not reachable yet is waited for, not fatal: the process stays up and /healthz keeps reporting it (WF-39).
    for (;;) {
      try {
        await h.generation.claim_loop.start();
        break;
      } catch (e) {
        if (h.tracker.draining) return;
        h.logger.warn("worker.start_retry", { extra: { name: e instanceof Error ? e.name : "unknown" } });
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    const r = await h.generation.claim_loop.run_until(stop);
    if (r.reason === "fatal") throw new Error("claim_loop fatal");
  });
  const checks = guard(async () => {
    await h.checks.check_lane.run_until(stop);
  });
  const lane = h.judge?.lane ?? null;
  const judge = lane ? guard(async () => { await lane.run_until(stop); }) : Promise.resolve();
  return { done: Promise.all([generation, checks, judge]).then(() => undefined) };
}
