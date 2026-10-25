// NL-48
// No logging in this file: rows carry user ids and minutes, which must never reach a log.
import Decimal from "decimal.js";
import { InvariantViolation } from "@ls/core/errors";
import type { BoardReadRepo, BoardRowRecord } from "@ls/core/ports/board-reads";
import type { DraftRating, LessonId, LessonStateName, UnitId } from "@ls/core/ports/common";
import type { HeartbeatRecord, LessonMetricsRecord, MetricsRepo, ReviewSessionRow } from "@ls/core/ports/metrics";
import type { Tx } from "@ls/core/ports/tx";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";

function real_tx(tx: Tx): DbTx {
  if (!(tx instanceof DbTx)) throw new InvariantViolation("repository write needs a real transaction");
  return tx;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg rows are untyped; each mapper names its columns
type Row = Record<string, any>;

const RATING_TO_INT: Record<DraftRating, number> = { usable_as_drafted: 1, usable_with_edits: 2, rewritten: 3 };
const INT_TO_RATING: Record<number, DraftRating> = { 1: "usable_as_drafted", 2: "usable_with_edits", 3: "rewritten" };

function session_row(r: Row): ReviewSessionRow {
  return {
    user_id: r["user_id"], lesson_id: r["lesson_id"], version_id: r["version_id"],
    started_at: r["started_at"], last_at: r["last_at"], active_seconds: Number(r["active_seconds"]), synthetic: r["synthetic"],
  };
}

function metrics_row(r: Row): LessonMetricsRecord {
  const rating = r["draft_rating"] === null ? undefined : INT_TO_RATING[Number(r["draft_rating"])];
  if (rating === undefined) throw new InvariantViolation("lesson_metrics row has no valid draft rating", { lesson_id: r["lesson_id"] });
  return {
    lesson_id: r["lesson_id"], version_id: r["version_id"],
    active_minutes: new Decimal(String(r["active_minutes"])), human_sessions: Number(r["human_sessions"]),
    teacher_word_count: Number(r["teacher_word_count"]), g2_threshold_minutes: new Decimal(String(r["g2_threshold_minutes"])),
    draft_rating: rating, approved_at: r["approved_at"],
  };
}

export class PgMetricsRepo implements MetricsRepo {
  private readonly db: PgDatabase;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
  }

  async insert_heartbeat(hb: HeartbeatRecord): Promise<void> {
    await this.db.with_tx(async (tx) => {
      await tx.query(
        `INSERT INTO heartbeat (user_id, tab_id, lesson_id, version_id, at, synthetic) VALUES ($1,$2,$3,$4,$5::timestamptz,$6)`,
        [hb.user_id, hb.tab_id, hb.lesson_id, hb.version_id, hb.at.toISOString(), hb.synthetic],
      );
    });
  }

  // The table has no unique index; the advisory lock is what keeps one row per (user, lesson, version) under two tabs.
  async extend_session(hb: HeartbeatRecord, gap_s: number): Promise<ReviewSessionRow> {
    return this.db.with_tx(async (tx) => {
      const cur = (
        await tx.query<Row>(
          `SELECT * FROM review_session WHERE user_id=$1 AND lesson_id=$2 AND version_id=$3 ORDER BY id LIMIT 1 FOR UPDATE`,
          [hb.user_id, hb.lesson_id, hb.version_id],
        )
      ).rows[0];
      if (!cur) {
        if (!hb.active) {
          return {
            user_id: hb.user_id, lesson_id: hb.lesson_id, version_id: hb.version_id,
            started_at: hb.at, last_at: hb.at, active_seconds: 0, synthetic: hb.synthetic,
          };
        }
        const ins = await tx.query<Row>(
          `INSERT INTO review_session (user_id, lesson_id, version_id, started_at, last_at, active_seconds, synthetic)
           VALUES ($1,$2,$3,$4::timestamptz,$4::timestamptz,0,$5) RETURNING *`,
          [hb.user_id, hb.lesson_id, hb.version_id, hb.at.toISOString(), hb.synthetic],
        );
        return session_row(ins.rows[0] as Row);
      }
      const last_ms = (cur["last_at"] as Date).getTime();
      if (!hb.active || hb.at.getTime() <= last_ms) return session_row(cur);
      const delta = Math.round((hb.at.getTime() - last_ms) / 1000);
      const add = delta <= gap_s ? delta : 0;
      const upd = await tx.query<Row>(
        `UPDATE review_session SET last_at=$2::timestamptz, active_seconds = active_seconds + $3 WHERE id=$1 RETURNING *`,
        [cur["id"], hb.at.toISOString(), add],
      );
      return session_row(upd.rows[0] as Row);
    }, `review_session:${hb.user_id}:${hb.lesson_id}:${hb.version_id}`);
  }

  // Contains user_id; consumed only by MetricsWriter. No route may expose it.
  async sessions_for(lesson_id: LessonId): Promise<ReviewSessionRow[]> {
    const rows = await this.db.with_tx(
      async (tx) => (await tx.query<Row>(`SELECT * FROM review_session WHERE lesson_id=$1 ORDER BY id`, [lesson_id])).rows,
    );
    return rows.map(session_row);
  }

  async first_approval_exists(lesson_id: LessonId, tx: Tx): Promise<boolean> {
    const res = await real_tx(tx).query(`SELECT 1 FROM lesson_metrics WHERE lesson_id=$1`, [lesson_id]);
    return res.rows.length > 0;
  }

  async write_lesson_metrics(row: LessonMetricsRecord, tx: Tx): Promise<boolean> {
    const res = await real_tx(tx).query(
      `INSERT INTO lesson_metrics (lesson_id, version_id, active_minutes, teacher_word_count, g2_threshold_minutes, draft_rating, human_sessions, approved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz) ON CONFLICT (lesson_id) DO NOTHING RETURNING lesson_id`,
      [
        row.lesson_id, row.version_id, row.active_minutes.toFixed(2), row.teacher_word_count, row.g2_threshold_minutes.toFixed(2),
        RATING_TO_INT[row.draft_rating], row.human_sessions, row.approved_at.toISOString(),
      ],
    );
    return res.rowCount > 0;
  }

  async unit_metrics_rows(unit_id: UnitId): Promise<LessonMetricsRecord[]> {
    const rows = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query<Row>(
            `SELECT m.* FROM lesson_metrics m JOIN lesson l ON l.id = m.lesson_id WHERE l.unit_id=$1 ORDER BY l.number NULLS LAST, l.id`,
            [unit_id],
          )
        ).rows,
    );
    return rows.map(metrics_row);
  }
}

// Read-only. Selects no minutes column, no user_id, and neither the heartbeat nor the session table.
export class PgBoardReadRepo implements BoardReadRepo {
  private readonly db: PgDatabase;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
  }

  async board_rows(unit_id: UnitId, state: LessonStateName | null): Promise<BoardRowRecord[]> {
    const rows = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query<Row>(
            `SELECT l.id AS lesson_id, l.number, l.type, l.title, l.state, u.name AS reviewer_name,
               GREATEST(
                 COALESCE((SELECT max(e.at) FROM review_event e WHERE e.lesson_id = l.id), 'epoch'::timestamptz),
                 COALESCE((SELECT max(v.stored_at) FROM lesson_version v WHERE v.lesson_id = l.id), 'epoch'::timestamptz)) AS last_change_at,
               EXISTS (SELECT 1 FROM lesson_link k JOIN lesson s ON s.id = k.to_lesson_id
                       WHERE k.from_lesson_id = l.id
                         AND k.outline_version_id = (SELECT ov.id FROM outline_version ov WHERE ov.unit_id = l.unit_id ORDER BY ov.number DESC LIMIT 1)
                         AND s.state NOT IN ('approved','exported')) AS dependency_flag
             FROM lesson l LEFT JOIN app_user u ON u.id = l.reviewer_id
             WHERE l.unit_id = $1 AND ($2::text IS NULL OR l.state = $2)
             ORDER BY l.number NULLS LAST, l.id`,
            [unit_id, state],
          )
        ).rows,
    );
    return rows.map((r) => ({
      lesson_id: r["lesson_id"], number: r["number"] === null ? null : Number(r["number"]), type: r["type"], title: r["title"],
      state: r["state"], reviewer_name: r["reviewer_name"], last_change_at: r["last_change_at"], dependency_flag: r["dependency_flag"],
    }));
  }
}
