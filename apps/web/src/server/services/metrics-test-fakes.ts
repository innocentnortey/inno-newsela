// NL-48: test helpers only (imported by tests; not exported from any package).
import type { LessonId, UnitId } from "@ls/core/ports/common";
import type { LessonRow } from "@ls/core/ports/lesson-state";
import type { HeartbeatRecord, LessonMetricsRecord, MetricsRepo, ReviewSessionRow } from "@ls/core/ports/metrics";
import type { LessonLookup } from "./heartbeat-service.ts";

// Same semantics as PgMetricsRepo (see packages/db/src/repos/metrics.ts).
export class InMemoryMetricsRepo implements MetricsRepo {
  heartbeats: HeartbeatRecord[] = [];
  sessions: ReviewSessionRow[] = [];
  rows: LessonMetricsRecord[] = [];

  async insert_heartbeat(hb: HeartbeatRecord): Promise<void> {
    this.heartbeats.push({ ...hb });
  }

  async extend_session(hb: HeartbeatRecord, gap_s: number): Promise<ReviewSessionRow> {
    const cur = this.sessions.find((s) => s.user_id === hb.user_id && s.lesson_id === hb.lesson_id && s.version_id === hb.version_id);
    if (!cur) {
      const fresh: ReviewSessionRow = {
        user_id: hb.user_id, lesson_id: hb.lesson_id, version_id: hb.version_id,
        started_at: hb.at, last_at: hb.at, active_seconds: 0, synthetic: hb.synthetic,
      };
      if (hb.active) this.sessions.push(fresh);
      return fresh;
    }
    if (!hb.active || hb.at.getTime() <= cur.last_at.getTime()) return cur;
    const delta = Math.round((hb.at.getTime() - cur.last_at.getTime()) / 1000);
    cur.active_seconds += delta <= gap_s ? delta : 0;
    cur.last_at = hb.at;
    return cur;
  }

  async sessions_for(lesson_id: LessonId): Promise<ReviewSessionRow[]> {
    return this.sessions.filter((s) => s.lesson_id === lesson_id);
  }

  async first_approval_exists(lesson_id: LessonId): Promise<boolean> {
    return this.rows.some((r) => r.lesson_id === lesson_id);
  }

  async write_lesson_metrics(row: LessonMetricsRecord, _tx?: unknown): Promise<boolean> {
    if (this.rows.some((r) => r.lesson_id === row.lesson_id)) return false;
    this.rows.push(row);
    return true;
  }

  async unit_metrics_rows(_unit_id: UnitId): Promise<LessonMetricsRecord[]> {
    void _unit_id;
    return [];
  }
}

export function known_lessons(ids: string[]): LessonLookup {
  return {
    get: async (lesson_id) =>
      ids.includes(lesson_id) ? ({ lesson_id, unit_id: "G6.U4", state: "in_review" } as unknown as LessonRow) : null,
  };
}
