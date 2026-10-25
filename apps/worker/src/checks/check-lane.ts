import type { Clock } from "@ls/core/ports/clock";
import type { Logger } from "@ls/obs/logger";
import type { CheckRunReport } from "./check-job-runner.ts";

export interface LaneStop {
  is_set(): boolean;
}
export interface CheckRunnerPort {
  run_once(): Promise<CheckRunReport | null>;
}

// The check lane: its own poll loop, no generation semaphore, no shared state with the claim loop.
// On stop it claims nothing new; the run in hand finishes first.
export class CheckLane {
  constructor(
    private readonly runner: CheckRunnerPort,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly settings: { check_poll_ms: number },
  ) {}

  async run_until(stop: LaneStop): Promise<{ checked: number }> {
    let checked = 0;
    while (!stop.is_set()) {
      let r: CheckRunReport | null;
      try {
        r = await this.runner.run_once();
      } catch (e) {
        this.logger.error("check_lane.failed", {
          extra: { name: e instanceof Error ? e.name : "unknown" },
        });
        await this.clock.sleep(this.settings.check_poll_ms);
        continue;
      }
      if (r === null) await this.clock.sleep(this.settings.check_poll_ms);
      else checked += 1;
    }
    return { checked };
  }
}
