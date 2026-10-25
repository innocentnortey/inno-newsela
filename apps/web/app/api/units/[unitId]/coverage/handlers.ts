// NL-91: getCoverageMatrix (CON-22). Every signed-in role reads; the handler lives here because src/server/routes is not this ticket's.
import { z } from "zod";
import { DomainRefusal } from "@ls/core/errors";
import type { RequestUser, UnitId } from "@ls/core/ports/common";
import type { CoverageMatrix } from "@ls/schema/api/metrics";
import { UnitId as UnitIdSchema } from "@ls/schema/ids";
import type { JsonValue, make_with_route, ProtectedRouteSpec, RouteHandler } from "@/server/http/with-route.ts";

export interface CoverageApi {
  coverage(user: RequestUser, unit_id: UnitId): Promise<CoverageMatrix>;
}

export interface CoverageRouteDeps {
  with_route: ReturnType<typeof make_with_route>;
  coverage: () => CoverageApi | null; // null = cut #4 is off: the route answers as if it were absent
}

const SPEC: ProtectedRouteSpec = {
  operation_id: "getCoverageMatrix",
  roles: null,
  request_schema: null,
  success_status: 200,
  params_schema: z.object({ unitId: UnitIdSchema }),
};

export function make_coverage_handlers(d: CoverageRouteDeps): { get_coverage: RouteHandler } {
  return {
    get_coverage: d.with_route(async (user, req) => {
      const svc = d.coverage();
      if (svc === null) throw new DomainRefusal("NOT_FOUND", "Not found.");
      return (await svc.coverage(user, req.path_params["unitId"] as UnitId)) as unknown as JsonValue;
    }, SPEC),
  };
}
