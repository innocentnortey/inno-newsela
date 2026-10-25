import type { CheckQueue, ClaimedCheck, PendingCheckState } from "@ls/core/ports/check-queue";
import type { Clock } from "@ls/core/ports/clock";
import type { LessonId, Sha256, StoreId } from "@ls/core/ports/common";
import type { Tx } from "@ls/core/ports/tx";
import { InvariantViolation } from "@ls/core/errors";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";
import { checked_hash_for } from "./issue-repo.ts";

export class PgCheckQueue implements CheckQueue {
  readonly #db: PgDatabase;
  readonly #clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.#db = deps.db;
    this.#clock = deps.clock;
  }

  async enqueue(lesson_id: LessonId, content_hash: Sha256, store_id: StoreId, tx: Tx): Promise<void> {
    if (!(tx instanceof DbTx)) throw new InvariantViolation("enqueue needs a real transaction");
    const upd = await tx.query(
      `UPDATE check_job SET content_hash=$2, store_id=$3 WHERE lesson_id=$1 AND status='queued'`,
      [lesson_id, content_hash, store_id],
    );
    if (upd.rowCount === 0) {
      // ON CONFLICT covers a concurrent enqueue between the UPDATE and the INSERT; enqueued_at stays oldest.
      await tx.query(
        `INSERT INTO check_job (lesson_id, content_hash, store_id, status, enqueued_at)
         VALUES ($1,$2,$3,'queued',$4::timestamptz)
         ON CONFLICT (lesson_id) WHERE status='queued'
         DO UPDATE SET content_hash=EXCLUDED.content_hash, store_id=EXCLUDED.store_id`,
        [lesson_id, content_hash, store_id, this.#clock.now().toISOString()],
      );
    }
    await tx.query(`SELECT pg_notify('check_job', $1)`, [lesson_id]); // delivered at commit, dropped on rollback
  }

  async claim(lease_ms: number): Promise<ClaimedCheck | null> {
    const now = this.#clock.now();
    return this.#db.with_tx(async (tx) => {
      const pick = await tx.query<{ id: string }>(
        `SELECT id FROM check_job
          WHERE status='queued' OR (status='running' AND lease_until < $1::timestamptz)
          ORDER BY enqueued_at ASC, id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [now.toISOString()],
      );
      const id = pick.rows[0]?.id;
      if (id === undefined) return null;
      const lease = new Date(now.getTime() + lease_ms);
      const r = await tx.query<ClaimedCheck>(
        `UPDATE check_job SET status='running', claimed_at=$2::timestamptz, lease_until=$3::timestamptz
          WHERE id=$1 RETURNING lesson_id, content_hash, store_id, lease_until`,
        [id, now.toISOString(), lease.toISOString()],
      );
      return r.rows[0] ?? null;
    });
  }

  async finish(check: ClaimedCheck): Promise<void> {
    // rowCount 0 (lease lost) is not an error; the worker handles it.
    await this.#db.with_tx((tx) =>
      tx.query(
        `UPDATE check_job SET status='done', finished_at=$4::timestamptz
          WHERE status='running' AND id = (SELECT max(id) FROM check_job
            WHERE lesson_id=$1 AND content_hash=$2 AND store_id=$3 AND status='running')`,
        [check.lesson_id, check.content_hash, check.store_id, this.#clock.now().toISOString()],
      ),
    );
  }

  async pending_for(lesson_id: LessonId): Promise<PendingCheckState> {
    return this.#db.with_tx(async (tx) => {
      const doc = (
        await tx.query<{ content_hash: Sha256; stored_at: Date }>(
          `SELECT content_hash, stored_at FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1`,
          [lesson_id],
        )
      ).rows[0];
      const queued = (
        await tx.query<{ content_hash: Sha256 }>(
          `SELECT content_hash FROM check_job WHERE lesson_id=$1 AND status='queued'`,
          [lesson_id],
        )
      ).rows[0];
      const checked = (await checked_hash_for(tx, lesson_id))?.content_hash ?? null;
      const open = (
        await tx.query(
          `SELECT 1 FROM check_job WHERE lesson_id=$1 AND status IN ('queued','running')
             AND content_hash IS DISTINCT FROM $2`,
          [lesson_id, checked],
        )
      ).rowCount > 0;
      const unchecked_store = doc !== undefined && doc.content_hash !== checked;
      return {
        lesson_id,
        pending: open || unchecked_store,
        newest_queued_hash: queued?.content_hash ?? null,
        latest_stored_hash: doc?.content_hash ?? null,
        latest_stored_at: doc?.stored_at ?? null,
      };
    });
  }
}

/** Stores whose newest doc has no check record and no open job after `unchecked_after_s` (config, default 30). */
export async function unchecked_stores(
  db: PgDatabase,
  now: Date,
  unchecked_after_s: number,
): Promise<Array<{ lesson_id: LessonId; content_hash: Sha256; stored_at: Date }>> {
  const cutoff = new Date(now.getTime() - unchecked_after_s * 1000);
  const r = await db.with_tx((tx) =>
    tx.query<{ lesson_id: LessonId; content_hash: Sha256; stored_at: Date }>(
      `SELECT d.lesson_id, d.content_hash, d.stored_at
         FROM (SELECT DISTINCT ON (lesson_id) lesson_id, content_hash, stored_at
                 FROM lesson_doc ORDER BY lesson_id, seq DESC) d
        WHERE d.stored_at <= $1::timestamptz
          AND NOT EXISTS (SELECT 1 FROM issue i WHERE i.lesson_id=d.lesson_id AND i.content_hash=d.content_hash)
          AND NOT EXISTS (SELECT 1 FROM check_job j WHERE j.lesson_id=d.lesson_id
                AND ((j.status='done' AND j.content_hash=d.content_hash) OR j.status IN ('queued','running')))
        ORDER BY d.stored_at, d.lesson_id`,
      [cutoff.toISOString()],
    ),
  );
  return r.rows;
}
