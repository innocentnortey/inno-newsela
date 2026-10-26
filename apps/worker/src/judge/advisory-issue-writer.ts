import type { Clock } from "@ls/core/ports/clock";
import type { LessonId, Sha256 } from "@ls/core/ports/common";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { PgDatabase } from "@ls/db/pool";

// NL-110. Worker-local writer for advisory `judge_no` issues. IssueRepo.replace_for_hash cannot append to a hash that
// already has issue rows and its port is frozen, so this inserts into the existing issue table directly (plan finding 2).
export interface JudgeNo {
  address: string;
  code: string;
  question: string;
}
export interface AdvisoryIssueWriter {
  append_advisory(lesson_id: LessonId, content_hash: Sha256, nos: readonly JudgeNo[]): Promise<number>;
}

export function judge_no_message(code: string): string {
  return `Provisional: the judge says this activity may not teach ${code}. Advisory only; it does not block Submit or Approve.`;
}

export class PgAdvisoryIssueWriter implements AdvisoryIssueWriter {
  private readonly db: PgDatabase;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(deps: { db: PgDatabase; ids: IdGenerator; clock: Clock }) {
    this.db = deps.db;
    this.ids = deps.ids;
    this.clock = deps.clock;
  }

  async append_advisory(lesson_id: LessonId, content_hash: Sha256, nos: readonly JudgeNo[]): Promise<number> {
    if (nos.length === 0) return 0;
    return this.db.with_tx(async (tx) => {
      // No row lock here (the claim transaction is short and has ended). Only the latest hash gets issues; a slow judge must not make an old hash look current (finding 3).
      const latest = await tx.query("SELECT content_hash FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [lesson_id]);
      if ((latest.rows[0] as { content_hash?: string } | undefined)?.content_hash !== content_hash) return 0;
      let inserted = 0;
      for (const no of nos) {
        const dup = await tx.query(
          "SELECT 1 FROM issue WHERE lesson_id=$1 AND content_hash=$2 AND kind='judge_no' AND address=$3 AND code=$4 LIMIT 1",
          [lesson_id, content_hash, no.address, no.code],
        );
        if (dup.rows.length > 0) continue;
        await tx.query(
          `INSERT INTO issue (id, lesson_id, content_hash, level, kind, message, address, span_anchor, related_lesson_id, code, created_at)
           VALUES ($1,$2,$3,'advisory','judge_no',$4,$5,NULL,NULL,$6,
             COALESCE((SELECT max(finished_at) FROM check_job WHERE lesson_id=$2 AND content_hash=$3 AND status='done'), $7))`,
          [this.ids.new_id("iss"), lesson_id, content_hash, judge_no_message(no.code), no.address, no.code, this.clock.now()],
        );
        inserted++;
      }
      return inserted;
    });
  }
}
