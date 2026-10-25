import type { Actor, LessonId } from "@ls/core/ports/common";
import type { AuditLog } from "@ls/core/ports/audit";
import type { CheckQueue } from "@ls/core/ports/check-queue";
import type { StoreAck } from "@ls/core/ports/collab-commands";
import type { LessonDocStore, SeedResult, StoreRequest } from "@ls/core/ports/lesson-docs";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { Tx } from "@ls/core/ports/tx";
import { InvariantViolation } from "@ls/core/errors";
import type { StoredLesson } from "@ls/schema/lesson";
import { lesson_to_ydoc } from "@ls/ydoc/convert";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";

export interface PgLessonDocStore_ctor extends PgRepoDeps {
  checks: CheckQueue;
  states: LessonStateRepo;
  audit: AuditLog;
}

const lock_key = (lesson_id: string): string => "lesson_doc:" + lesson_id;

const COLUMNS =
  "lesson_id, seq, store_id, ydoc_bytes, derived_json, content_hash, state_vector, schema_version, stored_by, stored_at, request_id";

// The only module that inserts into lesson_doc (AC-7).
export class PgLessonDocStore implements LessonDocStore {
  private readonly db;
  private readonly ids;
  private readonly clock;
  private readonly checks;
  private readonly states;
  private readonly audit;

  constructor(deps: PgLessonDocStore_ctor) {
    this.db = deps.db;
    this.ids = deps.ids;
    this.clock = deps.clock;
    this.checks = deps.checks;
    this.states = deps.states;
    this.audit = deps.audit;
  }

  async store(req: StoreRequest): Promise<StoreAck> {
    const store_id = this.ids.new_id("st");
    const stored_at = this.clock.now();
    return this.db.with_tx(async (tx) => {
      const ins = await tx.query(
        `INSERT INTO lesson_doc (${COLUMNS})
         VALUES ($1, (SELECT coalesce(max(seq),0)+1 FROM lesson_doc WHERE lesson_id=$1), $2,$3,$4::jsonb,$5,$6,$7,$8,$9::timestamptz,$10)
         RETURNING seq`,
        [
          req.lesson_id,
          store_id,
          Buffer.from(req.ydoc_bytes),
          JSON.stringify(req.derived),
          req.content_hash,
          Buffer.from(req.state_vector, "base64"),
          req.derived.schema_version,
          req.stored_by,
          stored_at.toISOString(),
          req.request_id,
        ],
      );
      const seq = Number((ins.rows[0] as { seq: number }).seq);
      await this.checks.enqueue(req.lesson_id, req.content_hash, store_id, tx);
      if (req.stored_by !== null) await this.states.record_last_editor(req.lesson_id, req.stored_by, tx);
      await this.audit.append(
        {
          actor_id: req.stored_by,
          action: "lesson.store",
          target_kind: "lesson",
          target_id: req.lesson_id,
          version_hash: req.content_hash,
          reason: null,
          details: { seq, tag: req.tag },
          request_id: req.request_id,
          store_id,
        },
        tx,
      );
      return {
        lesson_id: req.lesson_id,
        store_id,
        seq,
        content_hash: req.content_hash,
        state_vector: req.state_vector,
        stored_at,
        stored_by: req.stored_by,
        check_job_enqueued: true,
      };
    }, lock_key(req.lesson_id));
  }

  async seed_initial(lesson_id: LessonId, lesson: StoredLesson, actor: Actor, tx: Tx): Promise<SeedResult> {
    if (lesson.lesson_id !== lesson_id) throw new InvariantViolation("seed lesson id mismatch");
    if (!(tx instanceof DbTx)) throw new InvariantViolation("seed needs a real transaction");
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lock_key(lesson_id)]);
    const bytes = lesson_to_ydoc(lesson);
    const hash = content_hash(lesson);
    const sv = state_vector_of(bytes);
    const store_id = this.ids.new_id("st");
    const ins = await tx.query(
      `INSERT INTO lesson_doc (${COLUMNS})
       VALUES ($1, 1, $2,$3,$4::jsonb,$5,$6,$7,$8,$9::timestamptz,$10)
       ON CONFLICT (lesson_id, seq) DO NOTHING RETURNING store_id`,
      [
        lesson_id,
        store_id,
        Buffer.from(bytes),
        JSON.stringify(lesson),
        hash,
        Buffer.from(sv, "base64"),
        lesson.schema_version,
        actor.user_id,
        this.clock.now().toISOString(),
        null,
      ],
    );
    if (ins.rowCount === 0) return { lesson_id, seeded: false, store_id: null, content_hash: hash };
    await this.checks.enqueue(lesson_id, hash, store_id, tx);
    return { lesson_id, seeded: true, store_id, content_hash: hash };
  }
}
