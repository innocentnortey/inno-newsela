// Filled by NL-81 (A6): the check runner and its own lane. main.ts does not start the lane yet.
import type { PgDatabase } from "@ls/db/pool";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgIssueRepo } from "@ls/db/repos/issue-repo";
import { PgAlignmentRepo, PgSuggestionRepo, PgSafetyFlagRepo } from "@ls/db/repos/review-extras";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { CHECK_RULES } from "@ls/core/checks/registry";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import type { WorkerDeps } from "../deps-types.ts";
import { CheckJobRunner } from "../checks/check-job-runner.ts";
import { CheckLane } from "../checks/check-lane.ts";

export const FILLER = "NL-81" as const;

export interface CheckWiring {
  check_runner: CheckJobRunner;
  check_lane: CheckLane;
}

export function wire_checks(d: WorkerDeps): CheckWiring {
  // Repos only store the reference; construction never calls db (deps.ts stubs it until NL-83).
  const db = d.db as unknown as PgDatabase;
  const rd = { db, ids: d.ids, clock: d.clock };
  const queue = new PgCheckQueue(rd);
  const issues = new PgIssueRepo(rd);
  const alignment = new PgAlignmentRepo(rd);
  const suggestions = new PgSuggestionRepo(rd);
  const flags = new PgSafetyFlagRepo(rd);
  const graph = new PgLessonRepo(rd);
  const outlines = new PgOutlineRepo(rd);
  const standards = new PgStandardRepo(rd);
  const reader = new PgLessonDocReader({ db });
  const loader = new CheckContextLoader(
    outlines, standards, graph, reader, suggestions, flags, alignment, d.clock,
  );
  const check_runner = new CheckJobRunner(
    queue, reader, issues, alignment, graph, loader, CHECK_RULES, CHECK_POLICY, d.db, d.clock, d.logger,
  );
  const check_lane = new CheckLane(check_runner, d.clock, d.logger, {
    check_poll_ms: d.settings.check_poll_ms,
  });
  return { check_runner, check_lane };
}
