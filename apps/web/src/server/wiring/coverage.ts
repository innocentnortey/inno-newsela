// NL-91: the coverage service over the Pg repositories (cut #4). Its own file: BoardService and wiring/metrics.ts stay untouched.
import { PgBoardExtrasRepo } from "@ls/db/repos/board-extras";
import { PgBoardReadRepo } from "@ls/db/repos/metrics";
import { PgStandardRepo } from "@ls/db/repos/outlines";
import { PgAlignmentRepo } from "@ls/db/repos/review-extras";
import type { WebDeps } from "../deps.ts";
import { CoverageService } from "../services/coverage-service.ts";

export interface CoverageWiring {
  coverage: CoverageService;
}

export function wire_coverage(d: WebDeps): CoverageWiring {
  const deps = { db: d.db, ids: d.ids, clock: d.clock }; // constructors must not touch d.db
  return {
    coverage: new CoverageService(new PgAlignmentRepo(deps), new PgBoardReadRepo(deps), new PgStandardRepo(deps), new PgBoardExtrasRepo(deps)),
  };
}
