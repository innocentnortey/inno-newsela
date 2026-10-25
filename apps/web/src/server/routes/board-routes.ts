// NL-54: getUnitBoard (CON-9) and getUnitMetrics (CON-10). Every signed-in role reads; aggregate only (GR-15).
import { z } from "zod";
import type { RequestUser, UnitId } from "@ls/core/ports/common";
import { LessonState } from "@ls/schema/api/board";
import type { UnitBoard } from "@ls/schema/api/board";
import type { UnitMetrics } from "@ls/schema/api/metrics";
import { UnitId as UnitIdSchema } from "@ls/schema/ids";
import type { JsonValue, make_with_route, ProtectedRouteSpec, RouteHandler } from "../http/with-route.ts";

export interface BoardApi {
  board(user: RequestUser, unit_id: UnitId, state: LessonState | null): Promise<UnitBoard>;
  metrics(user: RequestUser, unit_id: UnitId): Promise<UnitMetrics>;
}

export interface BoardRouteDeps {
  with_route: ReturnType<typeof make_with_route>;
  board: () => BoardApi;
}

const BOARD_SPEC: ProtectedRouteSpec = {
  operation_id: "getUnitBoard",
  roles: null,
  request_schema: null,
  success_status: 200,
  params_schema: z.object({ unitId: UnitIdSchema }),
  query_schema: z.object({ state: LessonState.optional() }),
};

const METRICS_SPEC: ProtectedRouteSpec = {
  operation_id: "getUnitMetrics",
  roles: null,
  request_schema: null,
  success_status: 200,
  params_schema: z.object({ unitId: UnitIdSchema }),
};

export function make_board_handlers(d: BoardRouteDeps): { get_board: RouteHandler; get_metrics: RouteHandler } {
  return {
    get_board: d.with_route(async (user, req) => {
      const raw = req.query["state"];
      const state = typeof raw === "string" ? (raw as LessonState) : null;
      return (await d.board().board(user, req.path_params["unitId"] as UnitId, state)) as unknown as JsonValue;
    }, BOARD_SPEC),
    get_metrics: d.with_route(async (user, req) => {
      return (await d.board().metrics(user, req.path_params["unitId"] as UnitId)) as unknown as JsonValue;
    }, METRICS_SPEC),
  };
}
