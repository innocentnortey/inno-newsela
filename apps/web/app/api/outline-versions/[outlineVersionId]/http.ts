// NL-77: CON-3 getValidationReport and CON-4 recordIntakeChoice handlers; testable without Next.
import { z } from "zod";
import type { RequestUser } from "@ls/core/ports/common";
import type { IntakeChoiceRequest, IntakeChoiceResult, ValidationReport } from "@ls/schema/api/outlines";
import type { JsonValue, make_with_route, RouteHandler } from "@/server/http/with-route.ts";

export interface IntakeApi {
  report(user: RequestUser, id: string): Promise<ValidationReport>;
  record_choice(user: RequestUser, id: string, req: IntakeChoiceRequest): Promise<IntakeChoiceResult>;
}

// Loose on purpose: an unknown id must be NOT_FOUND, not INVALID_REQUEST.
const Params = z.object({ outlineVersionId: z.string().min(1).max(64) });

export function make_intake_handlers(d: {
  with_route: ReturnType<typeof make_with_route>;
  outlines: () => IntakeApi;
}): { get_report: RouteHandler; record_choice: RouteHandler } {
  const get_report = d.with_route(
    async (user, req) => (await d.outlines().report(user, req.path_params["outlineVersionId"] ?? "")) as unknown as JsonValue,
    { operation_id: "getValidationReport", roles: ["author", "reviewer", "approver"], request_schema: null, success_status: 200, params_schema: Params },
  );
  const record_choice = d.with_route(
    async (user, req) =>
      (await d.outlines().record_choice(user, req.path_params["outlineVersionId"] ?? "", req.body as IntakeChoiceRequest)) as unknown as JsonValue,
    { operation_id: "recordIntakeChoice", roles: ["author"], request_schema: "IntakeChoiceRequest", success_status: 200, params_schema: Params },
  );
  return { get_report, record_choice };
}
