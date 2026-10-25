// @vitest-environment node
// NL-25 AC-11: the container builds SessionService in stub mode without touching the database.
import { load_web_settings } from "@ls/config/settings";
import { beforeEach, describe, expect, it } from "vitest";
import { SERVICES_KEY, build_web_services } from "../container.ts";
import { SessionService } from "../services/session-service.ts";

const ENV = {
  DATABASE_URL: "postgres://u:p@127.0.0.1:1/none",
  AUDIT_HASH_SALT: "unused-test-salt-0000000000000000",
  COLLAB_INTERNAL_TOKEN: "unused-test-token-000000000000000",
};

describe("wire_sessions (AC-11)", () => {
  beforeEach(() => {
    delete (globalThis as unknown as Record<symbol, unknown>)[SERVICES_KEY];
  });
  it("services.sessions is a SessionService", () => {
    expect(build_web_services(load_web_settings(ENV)).sessions).toBeInstanceOf(SessionService);
  });
});
