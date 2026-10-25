import { describe, expect, it } from "vitest";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { WorkerDeps } from "../deps-types.ts";
import { CheckJobRunner } from "../checks/check-job-runner.ts";
import { CheckLane } from "../checks/check-lane.ts";
import { wire_checks } from "./checks.ts";

describe("wire_checks", () => {
  it("wire_checks_builds_runner", () => {
    const logger = { info() {}, warn() {}, error() {} };
    const deps = {
      settings: { check_poll_ms: 500 },
      logger,
      db: {},
      ids: new PrefixedIdGenerator(),
      clock: new SystemClock(),
    } as unknown as WorkerDeps;
    const w = wire_checks(deps);
    expect(w.check_runner).toBeInstanceOf(CheckJobRunner);
    expect(w.check_lane).toBeInstanceOf(CheckLane);
  });
});
