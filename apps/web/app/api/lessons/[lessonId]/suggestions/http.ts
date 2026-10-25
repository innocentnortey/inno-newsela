// NL-50 suggestion handlers (listSuggestions, requestSuggestion, decideSuggestion) over with_route.
// The Request/Response bridge is the shared one from next-adapter.ts (re-exported for the route files).
import { z } from "zod";
import type { LessonId, SuggestionId } from "@ls/core/ports/common";
import type { SuggestionDecisionRequest, SuggestionRequest } from "@ls/schema/api/lessons";
import { LessonId as LessonIdSchema, SuggestionId as SuggestionIdSchema } from "@ls/schema/ids";
import type { SuggestionApi } from "../../../../../src/server/services/suggestion-service.ts";
import type {
  JsonValue,
  make_with_route,
  RouteHandler,
} from "../../../../../src/server/http/with-route.ts";

export { to_http_request, to_response } from "../../../../../src/server/http/next-adapter.ts";

const LessonParams = z.object({ lessonId: LessonIdSchema });
const DecisionParams = z.object({ lessonId: LessonIdSchema, suggestionId: SuggestionIdSchema });

export interface SuggestionHandlers {
  list: RouteHandler;
  request: RouteHandler;
  decide: RouteHandler;
}

export function make_suggestion_handlers(deps: {
  with_route: ReturnType<typeof make_with_route>;
  suggestions: () => SuggestionApi;
}): SuggestionHandlers {
  const json = (v: unknown): JsonValue => v as unknown as JsonValue;
  return {
    list: deps.with_route(
      async (user, request) =>
        json(await deps.suggestions().list_pending(user, request.path_params["lessonId"] as LessonId)),
      {
        operation_id: "listSuggestions",
        roles: ["author", "reviewer", "approver"],
        request_schema: null,
        success_status: 200,
        params_schema: LessonParams,
      },
    ),
    request: deps.with_route(
      async (user, request) =>
        json(
          await deps
            .suggestions()
            .request(user, request.path_params["lessonId"] as LessonId, request.body as unknown as SuggestionRequest),
        ),
      {
        operation_id: "requestSuggestion",
        roles: ["reviewer"],
        request_schema: "SuggestionRequest",
        success_status: 201,
        params_schema: LessonParams,
      },
    ),
    decide: deps.with_route(
      async (user, request) =>
        json(
          await deps
            .suggestions()
            .decide(
              user,
              request.path_params["lessonId"] as LessonId,
              request.path_params["suggestionId"] as SuggestionId,
              request.body as unknown as SuggestionDecisionRequest,
            ),
        ),
      {
        operation_id: "decideSuggestion",
        roles: ["reviewer"],
        request_schema: "SuggestionDecisionRequest",
        success_status: 200,
        params_schema: DecisionParams,
      },
    ),
  };
}
