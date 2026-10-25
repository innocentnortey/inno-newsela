// NL-92: SQL-backed readers and writers for planting and scoring. The only place the seed tool touches tables.
import type { Actor, UserId } from "@ls/core/ports/common";
import type { Clock } from "@ls/core/ports/clock";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { EvidenceRepo } from "@ls/core/ports/evidence";
import type { Tx } from "@ls/db/tx";
import { PgDatabase } from "@ls/db/pool";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import type { StoredLesson } from "@ls/schema/lesson";

export const SEEDED_UNIT_ID = "G6.U99";
export const DEFAULT_PLANTER_EMAIL = "seed-planter@example.test";

export interface SeedDeps {
  db: PgDatabase;
  ids: IdGenerator;
  clock: Clock;
  evidence: EvidenceRepo;
  repo_root: string;
  git_sha: string;
  env: Record<string, string | undefined>;
  planter_email?: string;
}

export const unit_of = (lesson_id: string): string => lesson_id.split(".").slice(0, 2).join(".");

export class SeedSql {
  private readonly store: PgLessonDocStore;
  private readonly audit: PgAuditLog;

  constructor(private readonly d: SeedDeps) {
    const base = { db: d.db, ids: d.ids, clock: d.clock };
    this.audit = new PgAuditLog(base);
    this.store = new PgLessonDocStore({ ...base, checks: new PgCheckQueue(base), states: new PgLessonRepo(base), audit: this.audit });
  }

  private q<R>(sql: string, values: unknown[] = []): Promise<R[]> {
    return this.d.db.with_tx(async (tx) => (await tx.query(sql, values)).rows as R[]);
  }

  async standards_count(): Promise<number> {
    return Number((await this.q<{ n: number }>("SELECT count(*)::int AS n FROM standard"))[0]?.n ?? 0);
  }
  async lesson_exists(id: string): Promise<boolean> {
    return (await this.q("SELECT 1 FROM lesson WHERE id=$1", [id])).length > 0;
  }
  async latest_derived(id: string): Promise<StoredLesson | null> {
    const r = await this.q<{ derived_json: StoredLesson }>("SELECT derived_json FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [id]);
    return r[0]?.derived_json ?? null;
  }
  // The planter must never be a reviewer: by role, by assignment, or by having acted in a review.
  async planter_is_reviewer(email: string): Promise<boolean> {
    const r = await this.q<{ n: number }>(
      `SELECT count(*)::int AS n FROM app_user u WHERE lower(u.email)=lower($1) AND (
         u.role IN ('reviewer','approver')
         OR EXISTS (SELECT 1 FROM lesson l WHERE l.reviewer_id=u.id)
         OR EXISTS (SELECT 1 FROM review_event e WHERE e.actor_id=u.id))`,
      [email],
    );
    return Number(r[0]?.n ?? 0) > 0;
  }
  async ensure_planter(email: string): Promise<Actor & { user_id: UserId }> {
    const have = await this.q<{ id: string; name: string }>("SELECT id, name FROM app_user WHERE lower(email)=lower($1)", [email]);
    let id = have[0]?.id;
    const name = have[0]?.name ?? "Seed planter";
    if (id === undefined) {
      id = this.d.ids.new_id("usr");
      await this.q(
        "INSERT INTO app_user (id, email, name, role, synthetic, password_hash) VALUES ($1,$2,$3,'author',true,'!')",
        [id, email, name],
      );
    }
    return { user_id: id as UserId, name, role: "author", synthetic: true };
  }
  async ensure_unit(): Promise<void> {
    await this.q("INSERT INTO unit (id, grade, title) VALUES ($1, 6, 'Seeded-error review unit') ON CONFLICT (id) DO NOTHING", [SEEDED_UNIT_ID]);
  }

  // One transaction per plant: lesson row, v1 doc through seed_initial, one audit event (no plant id, marker or kind).
  async plant_one(lesson: StoredLesson, actor: Actor & { user_id: UserId }, plant_ref: string): Promise<string> {
    return this.d.db.with_tx(async (tx: Tx) => {
      const m = /\.L(\d+)$/.exec(lesson.lesson_id);
      await tx.query(
        `INSERT INTO lesson (id, unit_id, number, type, title, state, current_version_id, reviewer_id, last_editor_id, schema_version)
         VALUES ($1,$2,$3,$4,$5,'in_review',NULL,NULL,NULL,$6)`,
        [lesson.lesson_id, SEEDED_UNIT_ID, m ? Number(m[1]) : null, lesson.type, lesson.title, lesson.schema_version],
      );
      const seeded = await this.store.seed_initial(lesson.lesson_id, lesson, actor, tx);
      await this.audit.append(
        {
          actor_id: actor.user_id, action: "eval.seed_plant", target_kind: "lesson", target_id: lesson.lesson_id,
          version_hash: seeded.content_hash, reason: null, details: { planted_by: actor.user_id, plant_ref },
          request_id: null, store_id: seeded.store_id,
        },
        tx,
      );
      return seeded.content_hash;
    });
  }

  // Scoring reads.
  async issue_kinds(lesson_id: string, hash: string): Promise<string[]> {
    return (await this.q<{ kind: string }>("SELECT kind FROM issue WHERE lesson_id=$1 AND content_hash=$2", [lesson_id, hash])).map((r) => r.kind);
  }
  async later_versions(lesson_id: string): Promise<StoredLesson[]> {
    return (await this.q<{ derived_json: StoredLesson }>("SELECT derived_json FROM lesson_doc WHERE lesson_id=$1 AND seq>1 ORDER BY seq", [lesson_id])).map((r) => r.derived_json);
  }
  async send_back_notes(lesson_id: string): Promise<string[]> {
    return (await this.q<{ note: string | null }>("SELECT note FROM review_event WHERE lesson_id=$1 AND to_state='changes_requested'", [lesson_id])).map((r) => r.note ?? "");
  }
  async already_scored(eval_run_id: string): Promise<boolean> {
    const r = await this.q(
      "SELECT 1 FROM eval_run WHERE id=$1 AND finished_at IS NOT NULL UNION ALL SELECT 1 FROM eval_case_result WHERE eval_run_id=$1",
      [eval_run_id],
    );
    return r.length > 0;
  }
  async lesson_state(lesson_id: string): Promise<string | null> {
    return (await this.q<{ state: string }>("SELECT state FROM lesson WHERE id=$1", [lesson_id]))[0]?.state ?? null;
  }
}
