// NL-113 seed: lessons in chosen states through SQL (no UI, no collab), built on con-20's helpers (read-only here).
// Content is the synthetic WP-1 fixture (Lesson 4: slot q-hare, quote_placeholder, and slot hare-lion, excerpt_slot).
// WP-4 (Lesson 31) is the same compiled shape with its own id and title plus one open safety_flag row: the finding is
// created from that row, so the check only needs the row (plan 9.5).
import { randomBytes } from "node:crypto";
import { insert_row } from "@ls/db/testing/insert-row";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";
import { lesson_to_ydoc } from "@ls/ydoc/convert";
import { db } from "../support/db";
import { ensureOutline, ensureSeeded, freshUnit, WP1, type StoredLessonJson } from "../con-20/seed";

export interface SeededLesson {
  lessonId: string;
  unitKey: string;
  lessonKey: string;
  url: string;
}

const q = {
  query: async (text: string, values?: readonly unknown[]) => {
    const rows = await db().query(text, [...(values ?? [])]);
    return { rows, rowCount: rows.length };
  },
};
const rid = (p: string) => `${p}_e2e_${randomBytes(5).toString("hex")}`;

interface PM {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PM[];
}
// The WP-1 excerpt slot ships with a source, which counts as filled. Open it so both slot findings exist.
function openExcerpt(n: PM, unset = false): void {
  if (n.type === "excerpt_slot" && n.attrs) {
    n.attrs.source_ref = "";
    // checks/rules/links/slots.ts counts a slot as open only when rights is `unset` (or the source is null), unlike excerpt_slot_open.
    if (unset) n.attrs.rights = "unset";
  }
  for (const c of n.content ?? []) openExcerpt(c, unset);
}

async function insertLesson(
  unit: { unit_id: string; unit_key: string },
  number: number,
  state: "in_review" | "submitted" | "draft",
  title: string,
  mutate?: (l: StoredLessonJson) => void,
): Promise<SeededLesson & { hash: string; sv: string }> {
  await ensureSeeded();
  await ensureOutline(unit.unit_id);
  const lessonId = `${unit.unit_id}.L${number}`;
  const lesson = JSON.parse(JSON.stringify(WP1).replaceAll("G6.U4.L4", lessonId)) as StoredLessonJson;
  lesson.lesson_id = lessonId;
  lesson.title = title;
  for (const s of lesson.sections) openExcerpt(s.content as PM);
  mutate?.(lesson);
  const hash = content_hash(lesson as never);
  const vid = rid("lv");
  await insert_row(q, "lesson", {
    id: lessonId, unit_id: unit.unit_id, number, type: lesson.type, title, state, current_version_id: vid, reviewer_id: null, last_editor_id: null, schema_version: 1,
  });
  const prov = {
    outline_row_hash: "a".repeat(64), prompt_version_id: "pv_e2e", model: "stub", parameters: {}, schema_version: 1, example_set_id: null,
    run_id: null, model_call_ids: [], cost_usd: "0", ai_assisted_spans: 0, derived_from_version_id: null,
  };
  await insert_row(q, "lesson_version", {
    id: vid, lesson_id: lessonId, number: 1, kind: "generated", adopted: false, content_hash: hash, state_vector: null, lesson_json: JSON.stringify(lesson),
    draft_json: "{}", teacher_word_count: 100, provenance_json: JSON.stringify(prov), model_call_ids: "[]", dependency_record_json: "[]",
  });
  const bytes = lesson_to_ydoc(lesson as never);
  const sv = state_vector_of(bytes);
  await insert_row(q, "lesson_doc", {
    lesson_id: lessonId, seq: 1, store_id: rid("st"), ydoc_bytes: Buffer.from(bytes), derived_json: JSON.stringify(lesson), content_hash: hash,
    state_vector: Buffer.from(sv, "base64"), schema_version: 1,
  });
  if (state === "submitted") {
    await insert_row(q, "lesson_version", {
      id: rid("lv"), lesson_id: lessonId, number: 2, kind: "submit", adopted: false, content_hash: hash, state_vector: Buffer.from(sv, "base64"),
      lesson_json: JSON.stringify(lesson), draft_json: null, teacher_word_count: 100, provenance_json: JSON.stringify({ ...prov, derived_from_version_id: vid }),
      derived_from_version_id: vid, model_call_ids: "[]", dependency_record_json: "[]",
    });
  }
  const lessonKey = `L${number}`;
  return { lessonId, unitKey: unit.unit_key, lessonKey, url: `/units/${unit.unit_key}/lessons/${lessonKey}`, hash, sv };
}

/** Lesson 4 in a fresh unit. The check lane produces its issue list once enqueueCheck ran. */
export async function seedWp1(state: "in_review" | "submitted" = "in_review"): Promise<SeededLesson> {
  return insertLesson(await freshUnit(), 4, state, "Lesson 4: The Lightning Thief, Chapter 1 (NL-113)");
}

/** Lesson 4 plus Lesson 5 in the same unit and the cross_lesson_link from the L4 homework text to the L5 slot (UXP-2). */
export async function seedWp1WithL5(): Promise<{ l4: SeededLesson; l5: SeededLesson }> {
  const unit = await freshUnit();
  const l4 = await insertLesson(unit, 4, "in_review", "Lesson 4: The Lightning Thief, Chapter 1 (NL-113)");
  const l5 = await insertLesson(unit, 5, "in_review", "Lesson 5: Chapter 2 (NL-113)", (l) => {
    for (const s of l.sections) openExcerpt(s.content as PM, true);
  });
  // Stored links must equal the links computed from the outline rows (outlines.ts links()). The issued sheet gives L4 only a page
  // continuation, so rewrite the two outline rows: L4's homework quotes a title that L5's text set names, which computes one
  // homework_text link L4 -> L5 on slot `<L5>.excerpt-1` (the ordinal fallback in checks/rules/links/slots.ts finds hare-lion).
  const ov = `${unit.unit_id}.ov1`;
  const meta = (id: string, key: string, value: string) =>
    db().query(
      "update outline_row set codes_json = jsonb_set(codes_json, array['meta', $3::text], to_jsonb($4::text)) where outline_version_id = $1 and lesson_id = $2",
      [ov, id, key, value],
    );
  await meta(l4.lessonId, "homework", "Read the fable \u201cThe Hare and the Lion\u201d with a family member.");
  await meta(l5.lessonId, "text_set", "The Hare and the Lion");
  await db().query("delete from lesson_link where outline_version_id = $1", [ov]);
  await db().query("insert into lesson_link (outline_version_id, from_lesson_id, to_lesson_id, kind, slot_id) values ($1,$2,$3,'homework_text',$4)", [
    ov, l4.lessonId, l5.lessonId, `${l5.lessonId}.excerpt-1`,
  ]);
  return { l4, l5 };
}

/** Lesson 31 with one open safety flag sf:<lesson>:39. */
export async function seedWp4(state: "in_review" | "submitted" = "in_review"): Promise<SeededLesson & { flagId: string; hash: string; sv: string }> {
  const l = await insertLesson(await freshUnit(), 31, state, "Lesson 31: Safety note (NL-113)");
  const flagId = `sf:${l.lessonId}:39`;
  await insert_row(q, "safety_flag", { id: flagId, lesson_id: l.lessonId, source_row: 39, teacher_tip_address: null, status: "open", cleared_by: null, note: null, cleared_at: null });
  return { ...l, flagId };
}

/**
 * Lesson 4 whose front matter records SL.6.1 as `narrowed` and W.6.2 as `added`, both awaiting a reviewer
 * (L.6.4.b is a leaf under the listed parent L.6.4, so it gets no alignment rows; supporting codes do. The check lane derives standard_confirmation findings and alignment links from this, so SQL link rows would be replaced).
 */
export async function seedWp1WithStandards(): Promise<SeededLesson> {
  return insertLesson(await freshUnit(), 4, "in_review", "Lesson 4: The Lightning Thief, Chapter 1 (NL-113)", (l) => {
    const fm = l.front_matter as { standards: Record<string, unknown>[] };
    fm.standards.push(
      { code: "SL.6.1", role: "supporting", origin: "narrowed", official_text: "Synthetic standard text.", asserted_by: "generator", confirmation: "open" },
      { code: "W.6.2", role: "supporting", origin: "added", official_text: "Synthetic standard text.", asserted_by: "generator", confirmation: "open" },
    );
  });
}

/** One queued check_job for the stored hash, so the worker produces the initial issue list. */
export async function enqueueCheck(lessonId: string): Promise<void> {
  const d = (await db().query<{ content_hash: string; store_id: string }>("select content_hash, store_id from lesson_doc where lesson_id = $1 order by seq desc limit 1", [lessonId]))[0]!;
  await db().query(
    "insert into check_job (lesson_id, content_hash, store_id, status) values ($1,$2,$3,'queued') on conflict do nothing",
    [lessonId, d.content_hash, d.store_id],
  );
}
