// CON-16 routes: regenerateLesson (202), getCandidate (200), adoptCandidate (200). Handler factory plus the one
// body helper the shared Next adapter lacks (regenerate's body is optional).
import { z } from "zod";
import type { LessonId } from "@ls/core/ports/common";
import { LessonId as LessonIdSchema } from "@ls/schema/ids";
import type { AdoptRequest, RegenerateRequest } from "@ls/schema/api/lessons";
import type {
  HttpRequest,
  JsonValue,
  RouteHandler,
  make_with_route,
} from "../http/with-route.ts";
import type { CandidateApi } from "../services/candidate-service.ts";

const LessonParams = z.object({ lessonId: LessonIdSchema });
const CandidateParams = z.object({
  lessonId: LessonIdSchema,
  candidateId: z.string().min(1).max(200),
});

export function make_candidate_handlers(d: {
  with_route: ReturnType<typeof make_with_route>;
  candidates: () => CandidateApi;
}): {
  regenerate_lesson: RouteHandler;
  get_candidate: RouteHandler;
  adopt_candidate: RouteHandler;
} {
  return {
    regenerate_lesson: d.with_route(
      (user, req) =>
        d
          .candidates()
          .regenerate(
            user,
            req.path_params["lessonId"] as LessonId,
            req.body as RegenerateRequest,
          ) as unknown as Promise<JsonValue>,
      {
        operation_id: "regenerateLesson",
        roles: ["reviewer"],
        request_schema: "RegenerateRequest",
        success_status: 202,
        params_schema: LessonParams,
      },
    ),
    get_candidate: d.with_route(
      (user, req) =>
        d
          .candidates()
          .get(
            user,
            req.path_params["lessonId"] as LessonId,
            req.path_params["candidateId"] as string,
          ) as unknown as Promise<JsonValue>,
      {
        operation_id: "getCandidate",
        roles: null,
        request_schema: null,
        success_status: 200,
        params_schema: CandidateParams,
      },
    ),
    adopt_candidate: d.with_route(
      (user, req) =>
        d
          .candidates()
          .adopt(
            user,
            req.path_params["lessonId"] as LessonId,
            req.path_params["candidateId"] as string,
            req.body as AdoptRequest,
          ) as unknown as Promise<JsonValue>,
      {
        operation_id: "adoptCandidate",
        roles: ["reviewer"],
        request_schema: "AdoptRequest",
        success_status: 200,
        params_schema: CandidateParams,
      },
    ),
  };
}

// OpenAPI marks the regenerate body optional: an empty body means {}. Malformed JSON stays null so with_route
// answers INVALID_REQUEST. `raw` is a clone of the request taken before the shared adapter consumed it.
export async function with_optional_body(
  raw: Request,
  http: HttpRequest,
): Promise<HttpRequest> {
  const empty = (await raw.text()).trim() === "";
  return empty ? { ...http, body: {} } : http;
}
