// NL-36 test doubles (frozen with the NL-36 tests). SQL-backed stand-ins for NL-37's CheckQueue and NL-42's
// LessonStateRepo, which are not merged yet, plus failing wrappers for the atomicity cases. Reads only: this
// file never writes lesson_doc (AC-7).
import { readFileSync } from "node:fs";
import type { Actor } from "@ls/core/ports/common";
import type { AuditLog, NewAuditEvent } from "@ls/core/ports/audit";
import type { CheckQueue } from "@ls/core/ports/check-queue";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { Tx } from "@ls/core/ports/tx";
import type { StoredLesson } from "@ls/schema/lesson";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";
import { lesson_to_ydoc } from "@ls/ydoc/convert";
import type { StoreRequest } from "@ls/core/ports/lesson-docs";
import { insert_row } from "../testing/insert-row.ts";
import type { TestDb } from "../testing/test-db.ts";

export const WP1_LESSON_ID = "G6.U4.L4";
export const SYSTEM_ACTOR: Actor = { user_id: null, name: "system", role: null, synthetic: true };

export const wp1 = (): StoredLesson =>
  JSON.parse(readFileSync(new URL("../../../ydoc/tests/fixtures/stored-wp1.json", import.meta.url), "utf8")) as StoredLesson;

// A distinct, valid edit of the WP-1 lesson: a new title gives a new hash and state vector.
export const edited = (n: number): StoredLesson => ({ ...wp1(), title: `${wp1().title} (edit ${n})` });

export function request_for(lesson: StoredLesson, over: Partial<StoreRequest> = {}): StoreRequest {
  const bytes = lesson_to_ydoc(lesson);
  return {
    lesson_id: lesson.lesson_id,
    ydoc_bytes: bytes,
    derived: lesson,
    content_hash: content_hash(lesson),
    state_vector: state_vector_of(bytes),
    stored_by: null,
    request_id: null,
    tag: null,
    ...over,
  };
}

const unsupported = (name: string): never => {
  throw new Error(`test double: ${name} is not used by the store`);
};

function real(tx: Tx): { query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> } {
  return tx as never;
}

export class SqlCheckQueue implements CheckQueue {
  async enqueue(lesson_id: string, hash: string, store_id: string, tx: Tx): Promise<void> {
    const q = real(tx);
    const upd = await q.query(
      "UPDATE check_job SET content_hash=$2, store_id=$3, enqueued_at=now() WHERE lesson_id=$1 AND status='queued'",
      [lesson_id, hash, store_id],
    );
    if (upd.rowCount === 0) {
      await q.query("INSERT INTO check_job (lesson_id, content_hash, store_id, status) VALUES ($1,$2,$3,'queued')", [lesson_id, hash, store_id]);
    }
  }
  claim(): never { return unsupported("claim"); }
  finish(): never { return unsupported("finish"); }
  pending_for(): never { return unsupported("pending_for"); }
}

export class SqlLastEditor {
  async record_last_editor(lesson_id: string, user_id: string, tx: Tx): Promise<void> {
    await real(tx).query("UPDATE lesson SET last_editor_id=$2 WHERE id=$1", [lesson_id, user_id]);
  }
}
export const as_state_repo = (e: SqlLastEditor): LessonStateRepo => e as unknown as LessonStateRepo;

export class FailingCheckQueue extends SqlCheckQueue {
  override async enqueue(): Promise<void> {
    throw new Error("forced enqueue failure");
  }
}

export class FailingAudit implements AuditLog {
  constructor(private readonly inner: AuditLog) {}
  async append(_e: NewAuditEvent, _tx: Tx): Promise<never> {
    throw new Error("forced audit failure");
  }
  history(...a: Parameters<AuditLog["history"]>): ReturnType<AuditLog["history"]> {
    return this.inner.history(...a);
  }
  standard_decisions(...a: Parameters<AuditLog["standard_decisions"]>): ReturnType<AuditLog["standard_decisions"]> {
    return this.inner.standard_decisions(...a);
  }
}

export async function seed_world(t: TestDb, user_id: string, lesson_id = WP1_LESSON_ID): Promise<void> {
  await t.db.with_tx(async (tx) => {
    const have = await tx.query("SELECT 1 FROM app_user WHERE id=$1", [user_id]);
    if (have.rowCount === 0) await insert_row(tx, "app_user", { id: user_id, name: "Ada Test" });
    const lh = await tx.query("SELECT 1 FROM lesson WHERE id=$1", [lesson_id]);
    if (lh.rowCount === 0) await insert_row(tx, "lesson", { id: lesson_id, state: "in_review", last_editor_id: null });
  });
}

export async function scalar(t: TestDb, sql: string, values: unknown[] = []): Promise<unknown> {
  return t.db.with_tx(async (tx) => {
    const r = await tx.query(sql, values);
    return r.rows[0] ? Object.values(r.rows[0])[0] : undefined;
  });
}
export async function rows(t: TestDb, sql: string, values: unknown[] = []): Promise<Record<string, unknown>[]> {
  return t.db.with_tx(async (tx) => (await tx.query(sql, values)).rows as Record<string, unknown>[]);
}
