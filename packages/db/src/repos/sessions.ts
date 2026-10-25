import type { RoleName, Sha256, UserId } from "@ls/core/ports/common";
import type { Clock } from "@ls/core/ports/clock";
import type { AppSessionRow, AppUserCredentials, SessionContext, SessionRepo } from "@ls/core/ports/sessions";
import type { Tx } from "@ls/core/ports/tx";
import { InvariantViolation } from "@ls/core/errors";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: RoleName;
  synthetic: boolean;
}

const user_of = (r: UserRow): AppUserCredentials["user"] => ({
  user_id: r.id as UserId,
  email: r.email,
  name: r.name,
  role: r.role,
  synthetic: r.synthetic,
});

export class PgSessionRepo implements SessionRepo {
  private readonly db: PgDatabase;
  private readonly clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.clock = deps.clock;
  }

  async find_user_by_email(email: string): Promise<AppUserCredentials | null> {
    return this.db.with_tx(async (tx) => {
      const { rows } = await (tx as DbTx).query<UserRow & { password_hash: string }>(
        "SELECT id, email, name, role, synthetic, password_hash FROM app_user WHERE lower(email) = lower($1)",
        [email],
      );
      const r = rows[0];
      return r === undefined ? null : { user: user_of(r), password_hash: r.password_hash };
    });
  }

  async create_session(user_id: UserId, token_hash: Sha256, expires_at: Date, tx: Tx): Promise<AppSessionRow> {
    if (!(tx instanceof DbTx)) throw new InvariantViolation("create_session needs a database transaction", {});
    const { rows } = await tx.query<{ created_at: Date }>(
      "INSERT INTO app_session (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4) RETURNING created_at",
      [token_hash, user_id, this.clock.now(), expires_at],
    );
    return { token_hash, user_id, created_at: rows[0]!.created_at, expires_at };
  }

  // The one read path for a session; web and the collab authenticator both call it.
  async resolve(token_hash: Sha256, now: Date): Promise<SessionContext | null> {
    return this.db.with_tx(async (tx) => {
      const { rows } = await (tx as DbTx).query<UserRow & { created_at: Date; expires_at: Date }>(
        `SELECT u.id, u.email, u.name, u.role, u.synthetic, s.created_at, s.expires_at
           FROM app_session s JOIN app_user u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2`,
        [token_hash, now],
      );
      const r = rows[0];
      if (r === undefined) return null;
      return {
        user: user_of(r),
        session: { token_hash, user_id: r.id as UserId, created_at: r.created_at, expires_at: r.expires_at },
      };
    });
  }

  /** Which of these token hashes are still live sessions: one query for any number of hashes (collab S-9 sweep). */
  async live_hashes(token_hashes: Sha256[], now: Date): Promise<Set<Sha256>> {
    if (token_hashes.length === 0) return new Set();
    return this.db.with_tx(async (tx) => {
      const { rows } = await (tx as DbTx).query<{ token_hash: Sha256 }>(
        `SELECT token_hash FROM app_session
          WHERE token_hash = ANY($1::text[]) AND revoked_at IS NULL AND expires_at > $2`,
        [token_hashes, now],
      );
      return new Set(rows.map((r) => r.token_hash));
    });
  }

  async revoke(token_hash: Sha256, now: Date): Promise<void> {
    await this.db.with_tx(async (tx) => {
      await (tx as DbTx).query("UPDATE app_session SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL", [
        token_hash,
        now,
      ]);
    });
  }
}
