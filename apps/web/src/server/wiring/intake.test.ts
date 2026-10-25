// @vitest-environment node
// NL-26 AC-13 (implementer-written): wiring builds the real service without touching the database.
import { describe, expect, it } from "vitest";
import { load_web_settings } from "@ls/config/settings";
import { SERVICES_KEY, build_web_services } from "../container.ts";
import { OutlineService } from "../services/outline-service.ts";

describe("NL-26 wiring", () => {
  it("build_web_services stub mode returns an OutlineService", () => {
    delete (globalThis as unknown as Record<symbol, unknown>)[SERVICES_KEY];
    const s = build_web_services(load_web_settings({ DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" }));
    expect(s.outlines).toBeInstanceOf(OutlineService);
    delete (globalThis as unknown as Record<symbol, unknown>)[SERVICES_KEY];
  });
});
