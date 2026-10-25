// NL-91 AC-8: the container slot is a real CoverageService, and cut #4 off leaves the route absent.
import { describe, expect, it } from "vitest";
import { make_with_route, type RequestUser } from "../http/with-route.ts";
import { make_coverage_handlers } from "../../../app/api/units/[unitId]/coverage/handlers.ts";
import { make_request, make_log, SETTINGS } from "../http/testing/route-fixtures.ts";
import type { WebDeps } from "../deps.ts";
import { CoverageService } from "../services/coverage-service.ts";
import { wire_coverage } from "./coverage.ts";

describe("wire_coverage", () => {
  it("container_resolves_coverage_or_null", async () => {
    const boom = (): never => {
      throw new Error("db must not be touched at wiring time");
    };
    const trap = new Proxy({}, { get: boom });
    const on = wire_coverage({ db: trap, ids: trap, clock: trap, model_client: trap } as unknown as WebDeps);
    expect(on.coverage).toBeInstanceOf(CoverageService);

    // Cut #4 off: the slot is null and the handler answers NOT_FOUND, as if the route did not exist.
    const user = { user_id: "usr_synthetic_author", name: "Test", email: "a@example.test", role: "author", synthetic: true, request_id: "r" } as RequestUser;
    const { logger } = make_log();
    const off = make_coverage_handlers({
      with_route: make_with_route({ sessions: () => ({ require: async () => user }), logger, settings: SETTINGS }),
      coverage: () => null,
    });
    const res = await off.get_coverage(make_request({ method: "GET", path_params: { unitId: "G6.U4" }, body: null as never }));
    expect(res.status).toBe(404);
    expect((res.body as unknown as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });
});
