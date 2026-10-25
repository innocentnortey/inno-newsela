// NL-110 seed: a lesson in the state the check lane leaves it (done check_job + I/P alignment links), optionally carrying the stub judge's
// "no" marker in its first teaching paragraph. Content comes from con-20's seedLesson (WP-3 compiled lesson, approvable).
import { insert_row } from "@ls/db/testing/insert-row";
import { teaching_parts } from "@ls/core/checks/rules/alignment/standards-view";
import { visit_with_parts } from "@ls/core/checks/rules/structural/doc-walk";
import type { StoredLesson } from "@ls/schema/lesson";
import { db } from "../support/db";
import { createUser } from "../support/users";
import { ensureSeeded, freshUnit, seedLesson, type SeededLesson, type StoredLessonJson } from "../con-20/seed";
import type { Submitted } from "../con-20/flow";

export const STUB_JUDGE_NO_MARKER = "[stub-judge:no]";

const q = {
  query: async (text: string, values?: readonly unknown[]) => {
    const rows = await db().query(text, [...(values ?? [])]);
    return { rows, rowCount: rows.length };
  },
};

function mark_first_teaching(l: StoredLessonJson): void {
  const lesson = l as unknown as StoredLesson;
  const parts = teaching_parts(lesson);
  let done = false;
  for (const s of lesson.sections) {
    visit_with_parts(s, ({ node, address }) => {
      if (done || node.type !== "paragraph" || !parts.includes(address)) return;
      const t = node.content?.find((c) => typeof c.text === "string");
      if (t !== undefined) {
        t.text = `${t.text} ${STUB_JUDGE_NO_MARKER}`;
        done = true;
      }
    });
  }
  if (!done) throw new Error("no teaching paragraph to mark");
}

export async function submittedJudgeLesson(marker: boolean): Promise<Submitted & { pairs: number }> {
  await ensureSeeded();
  const unit = await freshUnit();
  const reviewer = await createUser("reviewer", { synthetic: false });
  const approver = await createUser("approver", { synthetic: false });
  const lesson: SeededLesson = await seedLesson({
    unit, number: 1, content: "wp3", state: "submitted", reviewer_id: reviewer.user_id, last_editor_id: reviewer.user_id,
    ...(marker ? { mutate: mark_first_teaching } : {}),
  });
  const doc = (await db().query<{ derived_json: StoredLesson; content_hash: string; store_id: string }>(
    "select derived_json, content_hash, store_id from lesson_doc where lesson_id = $1 order by seq desc limit 1", [lesson.lesson_id]))[0]!;
  await insert_row(q, "check_job", { lesson_id: lesson.lesson_id, content_hash: doc.content_hash, store_id: doc.store_id, status: "done", finished_at: new Date().toISOString() });
  const parts = teaching_parts(doc.derived_json);
  // The WP-3 flex-day lesson records no standards in its front matter; its outline row focuses RL.6.1 (a seeded leaf code).
  const recorded = doc.derived_json.front_matter.standards.map((s) => s.code);
  const codes = recorded.length > 0 ? recorded : ["RL.6.1"];
  let pairs = 0;
  for (const [i, address] of parts.entries()) {
    for (const code of codes) {
      await insert_row(q, "alignment_link", { lesson_id: lesson.lesson_id, content_hash: doc.content_hash, code, address, role: i === 0 ? "I" : "P", origin: "outline", asserted_by: "outline" });
      pairs += 1;
    }
  }
  return { reviewer, approver, lesson, unit, pairs };
}
