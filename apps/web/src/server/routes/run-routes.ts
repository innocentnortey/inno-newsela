// NL-78: getRunProgress, getUnitPlan, controlRun, getRunSummary handlers; testable without Next.
import { z } from "zod";
import type { RequestUser } from "@ls/core/ports/common";
import type { RunControlRequest, RunControlResult, RunProgress, UnitPlan } from "@ls/schema/api/runs";
import type { JsonValue, make_with_route, ProtectedRouteSpec, RouteHandler } from "../http/with-route.ts";
import type { RunSummaryResult } from "../services/run-read-model.ts";

export interface RunApi {
  progress(user: RequestUser, run_id: string): Promise<RunProgress>;
  plan(user: RequestUser, run_id: string): Promise<UnitPlan>;
  control(user: RequestUser, run_id: string, req: RunControlRequest): Promise<RunControlResult>;
  summary(user: RequestUser, run_id: string): Promise<RunSummaryResult>;
}

const params_schema = z.object({ runId: z.string().min(1).max(64) });
const read = (operation_id: string): ProtectedRouteSpec => ({ operation_id, roles: null, request_schema: null, success_status: 200, params_schema });

export function make_run_handlers(d: { with_route: ReturnType<typeof make_with_route>; runs: () => RunApi }): {
  progress: RouteHandler; plan: RouteHandler; actions: RouteHandler; summary: RouteHandler;
} {
  const id = (req: { path_params: Record<string, string> }): string => req.path_params["runId"] as string;
  return {
    progress: d.with_route(async (user, req) => (await d.runs().progress(user, id(req))) as unknown as JsonValue, read("getRunProgress")),
    plan: d.with_route(async (user, req) => (await d.runs().plan(user, id(req))) as unknown as JsonValue, read("getUnitPlan")),
    summary: d.with_route(async (user, req) => (await d.runs().summary(user, id(req))) as unknown as JsonValue, read("getRunSummary")),
    actions: d.with_route(
      async (user, req) => (await d.runs().control(user, id(req), req.body as unknown as RunControlRequest)) as unknown as JsonValue,
      { operation_id: "controlRun", roles: ["author"], request_schema: "RunControlRequest", success_status: 200, params_schema },
    ),
  };
}
