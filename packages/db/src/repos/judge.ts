import type { LessonId } from "@ls/core/ports/common";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { JudgeRepo, JudgeVerdictRow, NewJudgeVerdict } from "@ls/core/ports/judge";
import { InvariantViolation } from "@ls/core/errors";
import type { PgDatabase } from "../pool.ts";
import type { PgRepoDeps } from "./audit.ts";

// NL-89. judge_verdict is append-only (migration 0014): this class has insert and nothing else.
interface Raw {
  id: string;
  lesson_id: string;
  code: string;
  verdict: "yes" | "no";
  served_model: string;
  created_at: Date;
}

export class PgJudgeRepo implements JudgeRepo {
  private readonly db: PgDatabase;
  private readonly ids: IdGenerator;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.ids = deps.ids;
  }

  async insert_verdict(v: NewJudgeVerdict): Promise<JudgeVerdictRow> {
    const id = this.ids.new_id("ev");
    const rows = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query<Raw>(
            `insert into judge_verdict (id, lesson_id, content_hash, address, code, question, verdict, model_call_id, served_model)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             returning id, lesson_id, code, verdict, served_model, created_at`,
            [id, v.lesson_id, v.content_hash, v.address, v.code, v.question, v.verdict, v.model_call_id, v.served_model],
          )
        ).rows,
    );
    const r = rows[0];
    if (r === undefined) throw new InvariantViolation("judge verdict insert returned no row");
    return {
      verdict_id: r.id,
      lesson_id: r.lesson_id as LessonId,
      code: r.code,
      verdict: r.verdict,
      served_model: r.served_model,
      created_at: r.created_at,
    };
  }
}
