// NL-53: CON-18 transitionLesson. roles: null because TransitionService is the single role enforcer (ROLE_FORBIDDEN).
import { z } from "zod";
import type { LessonId } from "@ls/core/ports/common";
import { LessonId as LessonIdSchema } from "@ls/schema/ids";
import type { TransitionRequestInput } from "@ls/schema/api/transition";
import type { JsonValue, RouteHandler, make_with_route } from "../http/with-route.ts";
import type { TransitionApi } from "../services/transition-service.ts";

export function make_transition_handlers(d: {
  with_route: ReturnType<typeof make_with_route>;
  transitions: () => TransitionApi;
}): { transition_lesson: RouteHandler } {
  return {
    transition_lesson: d.with_route(
      (user, req) =>
        d
          .transitions()
          .transition(user, req.path_params["lessonId"] as LessonId, req.body as TransitionRequestInput) as unknown as Promise<JsonValue>,
      {
        operation_id: "transitionLesson",
        roles: null,
        request_schema: "TransitionRequestInput",
        success_status: 200,
        params_schema: z.object({ lessonId: LessonIdSchema }),
      },
    ),
  };
}
