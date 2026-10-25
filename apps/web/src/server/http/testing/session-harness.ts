// NL-25 frozen test harness (synthetic only). Do not edit: hashed in docs/plans/frozen-tests/NL-25.manifest.json.
import { createHash } from "node:crypto";
import { FakeClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { load_web_settings } from "@ls/config/settings";
import { create_logger } from "@ls/obs/logger";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgSessionRepo } from "@ls/db/repos/sessions";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { hash_password } from "../passwords.ts";
import { SessionService } from "../../services/session-service.ts";

export const ROLES = ["author", "reviewer", "approver"] as const;
export type SeedRole = (typeof ROLES)[number];
export const EMAIL: Record<SeedRole, string> = {
  author: "author.demo@example.test",
  reviewer: "reviewer.demo@example.test",
  approver: "approver.demo@example.test",
};
export const PASSWORD: Record<SeedRole, string> = {
  author: "demo-password-synthetic-author",
  reviewer: "demo-password-synthetic-reviewer",
  approver: "demo-password-synthetic-approver",
};
export const PW_MARKER = "PW-MARKER-91";
export const UNKNOWN_EMAIL_MARKER = "nobody-marker-91@example.test";
export const ORIGIN = "http://localhost:3000";
export const SALT = "unused-test-salt-0000000000000000";
export const START = new Date("2026-10-26T09:00:00.000Z");

export const sha256_hex = (s: string): string => createHash("sha256").update(s).digest("hex");

// FakeClock whose sleep() records the call and returns at once (FakeClock.sleep waits for advance()).
export class RecordingClock extends FakeClock {
  sleeps: number[] = [];
  override sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
    return Promise.resolve();
  }
}

export function web_env(database_url: string): Record<string, string> {
  return {
    DATABASE_URL: database_url,
    AUDIT_HASH_SALT: SALT,
    COLLAB_INTERNAL_TOKEN: "unused-test-token-000000000000000",
    APP_ORIGIN: ORIGIN,
  };
}

export interface Harness {
  t: TestDb;
  clock: RecordingClock;
  service: SessionService;
  lines: string[];
  logger: ReturnType<typeof create_logger>;
  user_ids: Record<SeedRole, string>;
  count(table: "app_session" | "audit_event", where?: string, values?: unknown[]): Promise<number>;
  all_rows_text(): Promise<string>;
  drop(): Promise<void>;
}

export async function make_harness(): Promise<Harness> {
  const t = await create_test_db();
  const clock = new RecordingClock(START);
  const ids = new PrefixedIdGenerator();
  const env = web_env(t.url);
  const settings = load_web_settings(env);
  const lines: string[] = [];
  const logger = create_logger({ service: "web", build_id: "test", write: (l) => lines.push(l) });
  const deps = { db: t.db, ids, clock };
  const service = new SessionService(new PgSessionRepo(deps), new PgAuditLog(deps), t.db, clock, ids, settings, logger);
  const user_ids = {} as Record<SeedRole, string>;
  await t.db.with_tx(async (tx) => {
    for (const role of ROLES) {
      const id = ids.new_id("usr");
      user_ids[role] = id;
      await insert_row(tx, "app_user", {
        id, email: EMAIL[role], name: `Demo ${role}`, role, synthetic: true, password_hash: hash_password(PASSWORD[role]),
      });
    }
  });
  const count: Harness["count"] = (table, where = "true", values = []) =>
    t.db.with_tx(async (tx) => Number((await tx.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, values)).rows[0]?.["n"]));
  const all_rows_text = () =>
    t.db.with_tx(async (tx) => {
      const out: string[] = [];
      for (const table of ["app_user", "app_session", "audit_event"]) {
        out.push(JSON.stringify((await tx.query(`SELECT * FROM ${table}`)).rows));
      }
      return out.join("\n");
    });
  return { t, clock, service, lines, logger, user_ids, count, all_rows_text, drop: () => t.drop() };
}
