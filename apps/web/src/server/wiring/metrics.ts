// NL-54: board and heartbeat services over the Pg repositories.
import { PgBoardExtrasRepo } from "@ls/db/repos/board-extras";
import { PgIssueRepo } from "@ls/db/repos/issue-repo";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgBoardReadRepo, PgMetricsRepo } from "@ls/db/repos/metrics";
import type { WebDeps } from "../deps.ts";
import { BoardService } from "../services/board-service.ts";
import { HeartbeatService } from "../services/heartbeat-service.ts";

export interface MetricsWiring {
  board: BoardService;
  heartbeats: HeartbeatService;
}

export function wire_metrics(d: WebDeps): MetricsWiring {
  const deps = { db: d.db, ids: d.ids, clock: d.clock }; // constructors must not touch d.db
  const metrics = new PgMetricsRepo(deps);
  const lessons = new PgLessonRepo(deps);
  return {
    board: new BoardService(new PgBoardReadRepo(deps), new PgIssueRepo(deps), metrics, new PgBoardExtrasRepo(deps), lessons, d.clock),
    heartbeats: new HeartbeatService(metrics, d.clock, d.settings, lessons),
  };
}
