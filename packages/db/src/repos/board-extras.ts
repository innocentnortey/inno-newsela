// NL-54
// No logging; read-only; selects no minutes. Gives the board its unit-exists check and latest send-backs.
import type { UnitId } from "@ls/core/ports/common";
import type { PgDatabase } from "../pool.ts";
import type { PgRepoDeps } from "./audit.ts";

// Structural copy of apps/web BoardExtrasRead (db must not import from apps/web).
interface SendBackRecord { lesson_id: string; tag: string | null; note: string; by: string; at: Date }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg rows are untyped; the mapper names its columns
type Row = Record<string, any>;

export class PgBoardExtrasRepo {
  private readonly db: PgDatabase;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
  }

  async unit_exists(unit_id: UnitId): Promise<boolean> {
    return this.db.with_tx(async (tx) => (await tx.query<Row>(`SELECT 1 FROM unit WHERE id=$1`, [unit_id])).rows.length > 0);
  }

  async unit_extras(unit_id: UnitId): Promise<{ send_backs: SendBackRecord[] } | null> {
    return this.db.with_tx(async (tx) => {
      if ((await tx.query<Row>(`SELECT 1 FROM unit WHERE id=$1`, [unit_id])).rows.length === 0) return null;
      const res = await tx.query<Row>(
        `SELECT DISTINCT ON (e.lesson_id) e.lesson_id, e.reason_tag, e.note, e.at, u.name AS by_name
           FROM review_event e
           JOIN lesson l ON l.id = e.lesson_id
           LEFT JOIN app_user u ON u.id = e.actor_id
          WHERE l.unit_id = $1 AND l.state = 'changes_requested' AND e.to_state = 'changes_requested'
          ORDER BY e.lesson_id, e.at DESC, e.id DESC`,
        [unit_id],
      );
      return {
        send_backs: res.rows.map((r) => ({
          lesson_id: r["lesson_id"], tag: r["reason_tag"], note: r["note"] ?? "", by: r["by_name"] ?? "", at: r["at"],
        })),
      };
    });
  }
}
