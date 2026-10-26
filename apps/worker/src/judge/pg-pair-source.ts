import type { LessonId, RunId, Sha256, UserId } from "@ls/core/ports/common";
import type { LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { StandardRepo } from "@ls/core/ports/standards";
import { node_text, visit_with_parts } from "@ls/core/checks/rules/structural/doc-walk";
import type { PgDatabase } from "@ls/db/pool";
import type { JudgeLessonContext, JudgePair, JudgePairSource } from "./pair-source.ts";

export const SYSTEM_JUDGE_USER = "usr_judge_system" as UserId;

// NL-110. Pairs are the distinct (code, address) of the I/P alignment_link rows of the hash (a code both Introduced and Practised at one address is one pair, not two: migration 0016 keys the row on role). The prompt gets activity text, official standard text,
// code and address only (AC-5): never other sections, outline notes or the title.
export class PgJudgePairSource implements JudgePairSource {
  private readonly db: PgDatabase;
  private readonly reader: LessonDocReader;
  private readonly standards: StandardRepo;

  constructor(deps: { db: PgDatabase; reader: LessonDocReader; standards: StandardRepo }) {
    this.db = deps.db;
    this.reader = deps.reader;
    this.standards = deps.standards;
  }

  async load(lesson_id: LessonId, content_hash: Sha256): Promise<JudgeLessonContext> {
    const meta = await this.db.with_tx(async (tx) => {
      const links = await tx.query(
        "SELECT DISTINCT code, address FROM alignment_link WHERE lesson_id=$1 AND content_hash=$2 AND role IN ('I','P') ORDER BY code, address",
        [lesson_id, content_hash],
      );
      const run = await tx.query("SELECT run_id FROM lesson_version WHERE lesson_id=$1 AND content_hash=$2 ORDER BY number DESC LIMIT 1", [lesson_id, content_hash]);
      const who = await tx.query(
        `SELECT COALESCE((SELECT stored_by FROM lesson_doc WHERE lesson_id=$1 AND content_hash=$2 ORDER BY seq DESC LIMIT 1),
                         (SELECT last_editor_id FROM lesson WHERE id=$1)) AS user_id`,
        [lesson_id, content_hash],
      );
      return {
        links: links.rows as { code: string; address: string }[],
        run_id: ((run.rows[0] as { run_id: string | null } | undefined)?.run_id ?? null) as RunId | null,
        user_id: ((who.rows[0] as { user_id: string | null } | undefined)?.user_id ?? SYSTEM_JUDGE_USER) as UserId,
      };
    });
    const derived = await this.reader.latest_derived(lesson_id);
    if (derived === null || derived.content_hash !== content_hash || meta.links.length === 0) {
      return { run_id: meta.run_id, user_id: meta.user_id, pairs: [] };
    }
    const texts = new Map((await this.standards.texts([...new Set(meta.links.map((l) => l.code))])).map((s) => [s.code, s.text]));
    const activity = new Map<string, string>();
    for (const section of derived.lesson.sections) {
      visit_with_parts(section, ({ node, address }) => {
        if (node.type !== "paragraph") return;
        const t = node_text(node).trim();
        if (t !== "") activity.set(address, ((activity.get(address) ?? "") + (activity.has(address) ? "\n" : "") + t));
      });
    }
    const pairs: JudgePair[] = [];
    for (const l of meta.links) {
      const standard_text = texts.get(l.code);
      const activity_text = activity.get(l.address);
      if (standard_text === undefined || activity_text === undefined) continue;
      pairs.push({ address: l.address, code: l.code, activity_text, standard_text, question: "teaches_standard" });
    }
    return { run_id: meta.run_id, user_id: meta.user_id, pairs };
  }
}
