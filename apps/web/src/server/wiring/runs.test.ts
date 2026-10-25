// @vitest-environment node
// NL-78 AC-14: wire_runs builds a real RunService (container and Pg wiring end to end).
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { load_web_settings } from "@ls/config/settings";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { create_logger } from "@ls/obs/logger";
import { SERVICES_KEY, build_web_services } from "../container.ts";
import type { WebDeps } from "../deps.ts";
import { RunService } from "../services/run-service.ts";
import { BASE_ENV, seed_stub_run } from "../services/testing/run-read-harness.ts";
import { wire_runs } from "./runs.ts";

const reset = () => {
  delete (globalThis as unknown as Record<symbol, unknown>)[SERVICES_KEY];
};
let t: TestDb | undefined;
afterAll(async () => {
  await t?.drop();
});
beforeEach(reset);
afterEach(reset);

describe("wire_runs (NL-78)", () => {
  it("container_resolves_runs", async () => {
    const services = build_web_services(load_web_settings(BASE_ENV));
    expect(services.runs).toBeInstanceOf(RunService);

    t = await create_test_db();
    const d = {
      db: t.db, ids: new PrefixedIdGenerator(), clock: { now: () => new Date(), sleep: async () => {} },
      logger: create_logger({ service: "web", build_id: "test", write: () => {} }), settings: load_web_settings(BASE_ENV), model_client: {} as never,
    } as unknown as WebDeps;
    const { runs } = wire_runs(d);
    const user = { user_id: "usr_synthetic_author", role: "author", request_id: "req_1" } as never;
    const s = await t.db.with_tx((tx) => seed_stub_run(tx, { state: "paused", paused_check: "circuit_breaker" }));
    expect((await runs.progress(user, s.run_id)).run_id).toBe(s.run_id);
    // The default notify (pg_notify in its own tiny transaction) runs after the commit and leaves no row behind.
    const before = await t.db.with_tx(async (tx) => (await tx.query("SELECT count(*)::int n FROM audit_event")).rows[0]?.["n"]);
    expect((await runs.control(user, s.run_id, { action: "resume" })).state).toBe("running");
    const after = await t.db.with_tx(async (tx) => (await tx.query("SELECT count(*)::int n FROM audit_event")).rows[0]?.["n"]);
    expect(after).toBe(before + 1);
  });
});
