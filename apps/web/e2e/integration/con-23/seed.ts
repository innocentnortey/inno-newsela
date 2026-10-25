// NL-102 seed: lessons in approved / exported / unapproved states through SQL (no UI, no collab), built on the con-20 seed.
// lesson_version is append-only, so "re-approve" inserts a new approve row; "edit live" changes only lesson_doc.
import { randomBytes } from "node:crypto";
import { insert_row } from "@ls/db/testing/insert-row";
import { content_hash } from "@ls/ydoc/hash";
import { db } from "../support/db";
import { createUser, type TestUser } from "../support/users";
import { seedLesson, type SeededLesson, type StoredLessonJson } from "../con-20/seed";

export { ensureSeeded, freshUnit } from "../con-20/seed";
export type { SeededLesson };

export const DRAFT_SENTINEL = "DRAFT-ONLY-5521";
type Unit = { unit_id: string; unit_key: string };

const q = {
  query: async (text: string, values?: readonly unknown[]) => {
    const rows = await db().query(text, [...(values ?? [])]);
    return { rows, rowCount: rows.length };
  },
};

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ulidId = (prefix: string): string => `${prefix}_${Array.from(randomBytes(26), (b) => CROCKFORD[b % 32]).join("")}`;

interface PM {
  type: string;
  text?: string;
  content?: PM[];
}

/** The lesson with its first non-empty text node replaced (everything else untouched, so the shape stays valid). */
export function withText(lesson: StoredLessonJson, text: string): StoredLessonJson {
  const copy = JSON.parse(JSON.stringify(lesson)) as StoredLessonJson;
  let done = false;
  const walk = (n: PM): void => {
    if (done) return;
    if (n.type === "text" && n.text) {
      n.text = text;
      done = true;
      return;
    }
    for (const k of n.content ?? []) walk(k);
  };
  for (const s of copy.sections) walk(s.content);
  if (!done) throw new Error("no text node to replace");
  return copy;
}

export const approverUser = (): Promise<TestUser> => createUser("approver");

export interface ApprovedLesson extends SeededLesson {
  approved: { version_id: string; content_hash: string; text: string };
}

async function addApprove(lesson_id: string, text: string, approver_id: string): Promise<ApprovedLesson["approved"]> {
  const [sub] = await db().query<{ id: string; lesson_json: StoredLessonJson; state_vector: Buffer | null; teacher_word_count: number; provenance_json: unknown }>(
    "select id, lesson_json, state_vector, teacher_word_count, provenance_json from lesson_version where lesson_id=$1 order by number desc limit 1",
    [lesson_id],
  );
  const n = (await db().query<{ n: number }>("select coalesce(max(number),0)+1 as n from lesson_version where lesson_id=$1", [lesson_id]))[0]!.n;
  const next = withText(sub!.lesson_json, text);
  const hash = content_hash(next as never);
  const version_id = ulidId("lv"); // the export schema wants lv_<ULID>
  await insert_row(q, "lesson_version", {
    id: version_id, lesson_id, number: n, kind: "approve", adopted: false, content_hash: hash, state_vector: sub!.state_vector,
    lesson_json: JSON.stringify(next), draft_json: null, teacher_word_count: sub!.teacher_word_count,
    provenance_json: JSON.stringify(sub!.provenance_json), derived_from_version_id: sub!.id, model_call_ids: "[]",
    dependency_record_json: "[]", created_by: approver_id,
  });
  return { version_id, content_hash: hash, text };
}

/** A lesson in state approved (or exported) with versions generated, submit, approve; the approve text is a unique sentinel. */
export async function seedApproved(o: {
  unit: Unit; number: number; approver_id: string; text?: string; state?: "approved" | "exported";
}): Promise<ApprovedLesson> {
  const base = await seedLesson({ unit: o.unit, number: o.number, state: "submitted" });
  const text = o.text ?? `APPROVED-TEXT-${o.number}-${randomBytes(3).toString("hex")}`;
  const approved = await addApprove(base.lesson_id, text, o.approver_id);
  await db().query("update lesson set state=$2, current_version_id=$3 where id=$1", [base.lesson_id, o.state ?? "approved", approved.version_id]);
  return { ...base, approved };
}

async function plantInLiveDoc(lesson_id: string, text: string): Promise<void> {
  const [d] = await db().query<{ derived_json: StoredLessonJson }>("select derived_json from lesson_doc where lesson_id=$1 order by seq desc limit 1", [lesson_id]);
  await db().query("update lesson_doc set derived_json=$2 where lesson_id=$1", [lesson_id, JSON.stringify(withText(d!.derived_json, text))]);
}

export async function seedDraft(o: { unit: Unit; number: number }): Promise<SeededLesson> {
  const l = await seedLesson({ unit: o.unit, number: o.number, state: "draft", title: `${DRAFT_SENTINEL} draft` });
  await plantInLiveDoc(l.lesson_id, DRAFT_SENTINEL);
  return l;
}
export async function seedInReview(o: { unit: Unit; number: number }): Promise<SeededLesson> {
  const l = await seedLesson({ unit: o.unit, number: o.number, state: "in_review", title: `${DRAFT_SENTINEL} in review` });
  await plantInLiveDoc(l.lesson_id, DRAFT_SENTINEL);
  return l;
}
export async function seedSubmitted(o: { unit: Unit; number: number }): Promise<SeededLesson> {
  const l = await seedLesson({ unit: o.unit, number: o.number, state: "submitted", title: `${DRAFT_SENTINEL} submitted` });
  await plantInLiveDoc(l.lesson_id, DRAFT_SENTINEL);
  return l;
}

/** The dependent lesson `from_number` waits on lesson `to_number` (the source). */
export async function linkLessons(unit: Unit, from_number: number, to_number: number, slot_id = "slot-1"): Promise<void> {
  const [ov] = await db().query<{ id: string }>("select id from outline_version where unit_id=$1 order by number desc limit 1", [unit.unit_id]);
  await db().query(
    "insert into lesson_link (outline_version_id, from_lesson_id, to_lesson_id, kind, slot_id) values ($1,$2,$3,$4,$5)",
    [ov!.id, `${unit.unit_id}.L${from_number}`, `${unit.unit_id}.L${to_number}`, "slot", slot_id],
  );
}

/** Reopen then approve again with new text (repository-level SQL, no UI). */
export async function reapprove(lesson: SeededLesson, newText: string, approver_id: string): Promise<ApprovedLesson["approved"]> {
  await db().query("update lesson set state='reopened' where id=$1", [lesson.lesson_id]);
  const approved = await addApprove(lesson.lesson_id, newText, approver_id);
  await db().query("update lesson set state='approved', current_version_id=$2 where id=$1", [lesson.lesson_id, approved.version_id]);
  return approved;
}

/** Edit only the live document, never the approve snapshot. */
export async function editLive(lesson: SeededLesson, text: string): Promise<void> {
  await plantInLiveDoc(lesson.lesson_id, text);
}
