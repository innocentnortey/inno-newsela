// NL-48: sendHeartbeat (CON-20). Answers 204 with an empty body: no minutes, no names.
import { z } from "zod";
import type { LessonId } from "@ls/core/ports/common";
import type { Heartbeat } from "@ls/schema/api/review";
import { LessonId as LessonIdSchema } from "@ls/schema/ids";
import type { HeartbeatService } from "../services/heartbeat-service.ts";
import type {
  make_with_route,
  ProtectedRouteSpec,
  RouteHandler,
} from "../http/with-route.ts";

export interface HeartbeatRouteDeps {
  with_route: ReturnType<typeof make_with_route>;
  heartbeats: () => Pick<HeartbeatService, "record">;
}

const SPEC: ProtectedRouteSpec = {
  operation_id: "sendHeartbeat",
  roles: ["reviewer", "approver"],
  request_schema: "Heartbeat",
  success_status: 204,
  params_schema: z.object({ lessonId: LessonIdSchema }),
};

export function make_heartbeat_handlers(d: HeartbeatRouteDeps): {
  send_heartbeat: RouteHandler;
} {
  return {
    send_heartbeat: d.with_route(async (user, req) => {
      await d
        .heartbeats()
        .record(
          user,
          req.path_params["lessonId"] as LessonId,
          req.body as unknown as Heartbeat,
        );
      return null;
    }, SPEC),
  };
}
