// NL-54: board and heartbeat services over the Pg repositories.
import { PgBoardExtrasRepo } from "@ls/db/repos/board-extras";
import { PgIssueRepo } from "@ls/db/repos/issue-repo";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgBoardReadRepo, PgMetricsRepo } from "@ls/db/repos/metrics";
import { PgUnitQualityReader } from "../read-models/unit-quality.ts";
import type { WebDeps } from "../deps.ts";
import { BoardService } from "../services/board-service.ts";
import { HeartbeatService } from "../services/heartbeat-service.ts";

export interface MetricsWiring {
  board: BoardService;
  heartbeats: HeartbeatService;
}

/** CUT_FLAGS: comma list of cut numbers (1..9) that have fired, e.g. "6". Anything else is ignored. */
export function parse_cut_flags(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^[1-9]$/.test(x))
    .map(Number);
}

export function wire_metrics(d: WebDeps): MetricsWiring {
  const deps = { db: d.db, ids: d.ids, clock: d.clock }; // constructors must not touch d.db
  const metrics = new PgMetricsRepo(deps);
  const lessons = new PgLessonRepo(deps);
  const cut6 = parse_cut_flags(process.env["CUT_FLAGS"]).includes(6);
  return {
    board: new BoardService(new PgBoardReadRepo(deps), new PgIssueRepo(deps), metrics, new PgBoardExtrasRepo(deps), lessons, d.clock, cut6 ? null : new PgUnitQualityReader(d.db)),
    heartbeats: new HeartbeatService(metrics, d.clock, d.settings, lessons),
  };
}
