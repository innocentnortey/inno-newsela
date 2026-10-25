// NL-47: four read-only lookups CandidateService needs that the DO-4 ports lack. Structurally satisfies the web
// layer's CandidateLookup interface (not imported, so @ls/db does not depend on apps/web).
import type { LessonId, RunId, VersionId } from "@ls/core/ports/common";
import type { PgDatabase } from "../pool.ts";
import type { PgRepoDeps } from "./audit.ts";

export class PgCandidateLookup {
  private readonly db: PgDatabase;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
  }

  private async rows(
    sql: string,
    params: unknown[],
  ): Promise<Record<string, unknown>[]> {
    return this.db.with_tx(async (tx) => (await tx.query(sql, params)).rows);
  }

  // Run of the lesson's queued or running candidate job.
  async in_flight_run(lesson_id: LessonId): Promise<RunId | null> {
    const r = await this.rows(
      "SELECT run_id FROM lesson_job WHERE lesson_id = $1 AND kind = 'candidate' AND status IN ('queued','running') LIMIT 1",
      [lesson_id],
    );
    return (r[0]?.["run_id"] as RunId | undefined) ?? null;
  }

  // Run of the lesson's newest kind='lesson' job (its own generation run); a never-generated lesson falls back to its newest candidate job (a trial run).
  async latest_lesson_run(lesson_id: LessonId): Promise<RunId | null> {
    const r = await this.rows(
      "SELECT run_id FROM lesson_job WHERE lesson_id = $1 AND kind IN ('lesson','candidate') ORDER BY (kind = 'lesson') DESC, queued_at DESC, id DESC LIMIT 1",
      [lesson_id],
    );
    return (r[0]?.["run_id"] as RunId | undefined) ?? null;
  }

  // Candidate version written by that run.
  async version_of_run(
    lesson_id: LessonId,
    run_id: RunId,
  ): Promise<VersionId | null> {
    const r = await this.rows(
      "SELECT id FROM lesson_version WHERE lesson_id = $1 AND run_id = $2 AND kind = 'candidate' ORDER BY number DESC LIMIT 1",
      [lesson_id, run_id],
    );
    return (r[0]?.["id"] as VersionId | undefined) ?? null;
  }

  // MAX(number)+1, for display while a candidate is still queued.
  async next_version_number(lesson_id: LessonId): Promise<number> {
    const r = await this.rows(
      "SELECT COALESCE(MAX(number), 0) + 1 AS n FROM lesson_version WHERE lesson_id = $1",
      [lesson_id],
    );
    return Number(r[0]?.["n"] ?? 1);
  }
}
