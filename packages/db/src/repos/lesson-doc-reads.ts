import type { DerivedRow, LessonDocReader, StoredDoc } from "@ls/core/ports/lesson-docs";
import type { LessonId } from "@ls/core/ports/common";
import { StoredLesson } from "@ls/schema/lesson";
import type { PgDatabase } from "../pool.ts";

type Row = Record<string, unknown>;

// Read side of lesson_doc: exactly two methods, no write path.
export class PgLessonDocReader implements LessonDocReader {
  private readonly db: PgDatabase;

  constructor(deps: { db: PgDatabase }) {
    this.db = deps.db;
  }

  private async newest(lesson_id: LessonId): Promise<Row | null> {
    return this.db.with_tx(async (tx) => {
      const r = await tx.query("SELECT * FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [lesson_id]);
      return (r.rows[0] as Row | undefined) ?? null;
    });
  }

  async latest(lesson_id: LessonId): Promise<StoredDoc | null> {
    const row = await this.newest(lesson_id);
    if (!row) return null;
    return {
      lesson_id: row["lesson_id"] as string,
      seq: Number(row["seq"]),
      store_id: row["store_id"] as string,
      ydoc_bytes: new Uint8Array(row["ydoc_bytes"] as Buffer),
      content_hash: row["content_hash"] as string,
      state_vector: (row["state_vector"] as Buffer).toString("base64"),
      schema_version: Number(row["schema_version"]),
      stored_at: row["stored_at"] as Date,
    } as StoredDoc;
  }

  async latest_derived(lesson_id: LessonId): Promise<DerivedRow | null> {
    const row = await this.newest(lesson_id);
    if (!row) return null;
    return {
      lesson_id: row["lesson_id"] as string,
      seq: Number(row["seq"]),
      store_id: row["store_id"] as string,
      lesson: StoredLesson.parse(row["derived_json"]),
      content_hash: row["content_hash"] as string,
      state_vector: (row["state_vector"] as Buffer).toString("base64"),
      schema_version: Number(row["schema_version"]),
      stored_at: row["stored_at"] as Date,
      stored_by: (row["stored_by"] as string | null) ?? null,
    } as DerivedRow;
  }
}
