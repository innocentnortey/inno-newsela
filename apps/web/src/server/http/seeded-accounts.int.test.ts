// NL-82 frozen test (risk::security), AC-3. Do not edit: hashed in docs/plans/frozen-tests/NL-82.manifest.json.
// Lives under apps/web because the web app may not import ops and ops may not import apps/web:
// the real seed CLI runs as a child process, then the real SessionService signs the seeded accounts in.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { load_web_settings } from "@ls/config/settings";
import { create_logger } from "@ls/obs/logger";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgSessionRepo } from "@ls/db/repos/sessions";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { SessionService } from "../services/session-service.ts";
import { RecordingClock, START, web_env } from "./testing/session-harness.ts";

const ROOT = resolve(import.meta.dirname, "../../../../..");
const SEED_PW = "QzSeed-Pass-82!";
let t: TestDb;
let service: SessionService;

beforeAll(async () => {
  t = await create_test_db();
  const r = spawnSync("npx", ["tsx", "ops/seed.ts"], { cwd: ROOT, env: { ...process.env, DATABASE_URL: t.url, SEED_DEMO_PASSWORD: SEED_PW }, encoding: "utf8" });
  expect(r.status, r.stderr).toBe(0);
  const clock = new RecordingClock(START);
  const ids = new PrefixedIdGenerator();
  const deps = { db: t.db, ids, clock };
  const logger = create_logger({ service: "web", build_id: "test", write: () => undefined });
  service = new SessionService(new PgSessionRepo(deps), new PgAuditLog(deps), t.db, clock, ids, load_web_settings(web_env(t.url)), logger);
}, 90_000);
afterAll(async () => {
  await t?.drop();
});

describe("seeded accounts", () => {
  it("seeded_accounts_sign_in_with_their_role [invariant] each demo account signs in with the seeded password and its own role", async () => {
    for (const role of ["author", "reviewer", "approver"] as const) {
      const out = await service.sign_in({ email: `${role}.demo@example.test`, password: SEED_PW }, { request_id: `req-${role}`, ip_hash: null });
      expect(out.session.user.role).toBe(role);
    }
    const rows = (await t.db.with_tx((tx) => tx.query(`SELECT role, synthetic FROM app_user ORDER BY role`))).rows;
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r["synthetic"] === true)).toBe(true);
  });

  it("seeded_accounts_refuse_wrong_password [negative] a wrong password is refused for a seeded account", async () => {
    await expect(service.sign_in({ email: "author.demo@example.test", password: "not-the-password" }, { request_id: "req-bad", ip_hash: null })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});
