// NL-121: reads the generated unit from the database as structural facts (type, section names, focus codes).
import type { LessonId, VersionId } from "@ls/core/ports/common";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { PgDatabase } from "@ls/db/pool";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import type { LessonFacts } from "./compare.ts";

export interface GeneratedLesson {
  number: number;
  facts: LessonFacts;
}
export interface GeneratedReader {
  lessons(unit_id: string): Promise<{ lessons: GeneratedLesson[]; without_number: number }>;
}

export function make_pg_generated_reader(db: PgDatabase): GeneratedReader {
  const repo = new PgLessonRepo({ db, ids: new PrefixedIdGenerator(), clock: new SystemClock() });
  return {
    async lessons(unit_id) {
      const rows = await db.with_tx(async (tx) =>
        (await tx.query<{ id: LessonId; number: number | null }>("SELECT id, number FROM lesson WHERE unit_id=$1 ORDER BY number NULLS LAST", [unit_id])).rows);
      const lessons: GeneratedLesson[] = [];
      let without_number = 0;
      for (const r of rows) {
        if (r.number === null) {
          without_number++;
          continue;
        }
        const vids = await db.with_tx(async (tx) =>
          (await tx.query<{ id: VersionId }>("SELECT id FROM lesson_version WHERE lesson_id=$1 AND kind='generated' ORDER BY number LIMIT 1", [r.id])).rows);
        if (vids[0] === undefined) continue;
        const row = await repo.version(vids[0].id);
        if (row === null) continue;
        const l = row.lesson;
        lessons.push({
          number: r.number,
          facts: {
            type: l.type,
            sections: l.sections.map((s) => s.name),
            focus: l.front_matter.standards.filter((s) => s.role === "focus" && s.confirmation !== "removed").map((s) => s.code),
          },
        });
      }
      return { lessons, without_number };
    },
  };
}
