// NL-115 seed (frozen with the risk::security cases): lessons in chosen states by SQL, on top of NL-99's seed helpers
// (read-only imports). Differences from NL-99 that this join needs:
//  - the WP-1 fixture is flawed on purpose (rights_to_clear, missing sections: none resolvable), so no WP-1 lesson can ever be
//    approved. The happy-path and refusal lessons use the compiled WP-3 flex-day draft (every blocking finding resolvable), as
//    NL-99 does, and WP-1 only where a refusal is the point (precedence, BLOCKED);
//  - two approvable lessons are needed in one unit (a dependant and its source), so the flex outline row is copied under a
//    second lesson number. Lesson numbers L98 (dependant, "Lesson 4" in the ticket) and L99 (source, "Lesson 5") stand in for them.
import { randomBytes } from "node:crypto";
import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { insert_row } from "@ls/db/testing/insert-row";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";
import { lesson_to_ydoc } from "@ls/ydoc/convert";
import { db } from "../support/db";
import { createUser, type TestUser } from "../support/users";
import { WP1, WP3, ensureOutline, ensureSeeded, freshUnit, type SeededLesson, type StoredLessonJson } from "../con-20/seed";

export { ensureSeeded, freshUnit };
export type { SeededLesson };

const WP3_BLOCKING = JSON.parse(readFileSync(resolve(__dirname, "../con-20/fixtures/wp3-blocking.json"), "utf8")) as { kind: string; message: string; address: string; code: string | null }[];

const q = {
  query: async (text: string, values?: readonly unknown[]) => {
    const rows = await db().query(text, [...(values ?? [])]);
    return { rows, rowCount: rows.length };
  },
};

interface PM {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: PM[];
}
function words(n: PM): number {
  if (n.type === "teacher_tip") return 0;
  const kids = n.content ?? [];
  if (kids.some((k) => k.type === "text" || k.type === "hard_break")) return (text(n).match(/\S+/g) ?? []).length;
  return kids.reduce((s, k) => s + words(k), 0);
}
function text(n: PM): string {
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hard_break") return " ";
  return (n.content ?? []).map(text).join("");
}

export const DEPENDANT = 98; // "Lesson 4": waits on the source
export const SOURCE = 99; // "Lesson 5": the dependant's link points at its slot

/** The title the dependant's homework quotes and the source's text set names: the outline's own link rule connects them. */
const SYNTHETIC_TITLE = "The Synthetic Hare Tale";

/**
 * The unit's flex outline row is copied under L98 so a second approvable lesson matches an outline row, and the two rows
 * are joined the way the issued sheet joins Lesson 4 to Lesson 5: L98's homework quotes a title that L99's text set names.
 * The stored lesson_link must equal what compute_lesson_links derives from the rows (the outline repo throws otherwise).
 */
async function ensureDependantRow(unit_id: string): Promise<void> {
  const id = `${unit_id}.ov1`;
  if ((await db().count("outline_row", "outline_version_id = $1 and lesson_id = $2", [id, `${unit_id}.L${DEPENDANT}`])) > 0) return;
  await db().query(
    `insert into outline_row (outline_version_id, row_number, kind, lesson_id, segments_json, codes_json, findings_json, row_hash)
     select outline_version_id, (select max(row_number) + 1 from outline_row where outline_version_id = $1), kind, $3, segments_json,
            jsonb_set(codes_json, '{meta,homework}', to_jsonb($4::text)), findings_json, row_hash
       from outline_row where outline_version_id = $1 and lesson_id = $2`,
    [id, `${unit_id}.L${SOURCE}`, `${unit_id}.L${DEPENDANT}`, `• Read and annotate “${SYNTHETIC_TITLE}”`],
  );
  await db().query(
    "update outline_row set codes_json = jsonb_set(codes_json, '{meta,text_set}', to_jsonb($3::text)) where outline_version_id = $1 and lesson_id = $2",
    [id, `${unit_id}.L${SOURCE}`, `• A short excerpt from “${SYNTHETIC_TITLE}”`],
  );
  // Links are only derived between kind "lesson" rows (compute_lesson_links skips flex days).
  await db().query("update outline_row set kind = 'lesson' where outline_version_id = $1 and lesson_id = any($2)", [id, [`${unit_id}.L${SOURCE}`, `${unit_id}.L${DEPENDANT}`]]);
}

export const slotOf = (unit_id: string): string => `${unit_id}.L${SOURCE}.excerpt-1`;
export interface FlexOpts {
  unit: { unit_id: string; unit_key: string };
  number: number; // DEPENDANT or SOURCE
  state: "in_review" | "submitted" | "approved";
  reviewer_id?: string | null;
  last_editor_id?: string | null;
  /** Put a filled excerpt slot in this lesson (the source of a link). */
  slot_id?: string;
  /** Record one open "added" standard so the lesson carries a confirmation issue (CONFIRMATION_OPEN). */
  confirmation?: boolean;
  /** Record every resolvable blocking finding as resolved (default true); false leaves them open, so Submit and Approve are blocked. */
  resolved?: boolean;
}

export async function seedFlex(o: FlexOpts): Promise<SeededLesson> {
  const lesson_id = `${o.unit.unit_id}.L${o.number}`;
  await ensureOutline(o.unit.unit_id);
  await ensureDependantRow(o.unit.unit_id);
  const renamed = JSON.parse(JSON.stringify(WP3).replaceAll("G6.U4.FLEX-1a", lesson_id)) as StoredLessonJson & {
    front_matter: { standards: unknown[] };
    sections: { content: PM }[];
  };
  const lesson = { ...renamed, lesson_id, title: `${WP3.title} (seed ${o.number})` };
  if (o.slot_id) {
    const last = lesson.sections[lesson.sections.length - 1]!;
    last.content = { ...last.content, content: [...(last.content.content ?? []), { type: "excerpt_slot", attrs: { slot_id: o.slot_id, source_ref: "synthetic-source", rights: "licensed" } }] };
  }
  if (o.confirmation) {
    lesson.front_matter = {
      ...lesson.front_matter,
      standards: [
        { code: "L.6.4.b", role: "supporting", origin: "added", official_text: "Synthetic standard text.", asserted_by: "generator", confirmation: "open" },
      ],
    };
  }
  const total = lesson.sections.reduce((n, sec) => n + words(sec.content), 0);
  const hash = content_hash(lesson as never);
  const bytes = lesson_to_ydoc(lesson as never);
  const sv = state_vector_of(bytes);
  const vid = `lv_e2e_${randomBytes(5).toString("hex")}`;
  await insert_row(q, "lesson", {
    id: lesson_id, unit_id: o.unit.unit_id, number: o.number, type: WP3.type, title: lesson.title, state: o.state,
    current_version_id: vid, reviewer_id: o.reviewer_id ?? null, last_editor_id: o.last_editor_id ?? null, schema_version: 1,
  });
  const prov = {
    outline_row_hash: "a".repeat(64), prompt_version_id: "pv_e2e", model: "stub", parameters: {}, schema_version: 1,
    example_set_id: null, run_id: null, model_call_ids: [], cost_usd: "0", ai_assisted_spans: 0, derived_from_version_id: null,
  };
  await insert_row(q, "lesson_version", {
    id: vid, lesson_id, number: 1, kind: "generated", adopted: false, content_hash: hash, state_vector: null,
    lesson_json: JSON.stringify(lesson), draft_json: "{}", teacher_word_count: total, provenance_json: JSON.stringify(prov),
    model_call_ids: "[]", dependency_record_json: "[]",
  });
  await insert_row(q, "lesson_doc", {
    lesson_id, seq: 1, store_id: `st_e2e_${randomBytes(5).toString("hex")}`, ydoc_bytes: Buffer.from(bytes),
    derived_json: JSON.stringify(lesson), content_hash: hash, state_vector: Buffer.from(sv, "base64"), schema_version: 1,
  });
  await recordBlocking(lesson_id, hash, o.resolved !== false);
  const out: SeededLesson = { lesson_id, unit_id: o.unit.unit_id, unit_key: o.unit.unit_key, lesson_key: `L${o.number}`, words: total };
  if (o.state === "submitted" || o.state === "approved") {
    const sid = `lv_e2e_${randomBytes(5).toString("hex")}`;
    await insert_row(q, "lesson_version", {
      id: sid, lesson_id, number: 2, kind: "submit", adopted: false, content_hash: hash, state_vector: Buffer.from(sv, "base64"),
      lesson_json: JSON.stringify(lesson), draft_json: null, teacher_word_count: total,
      provenance_json: JSON.stringify({ ...prov, derived_from_version_id: vid }), derived_from_version_id: vid,
      model_call_ids: "[]", dependency_record_json: "[]",
    });
    out.snapshot = { version_id: sid, content_hash: hash, state_vector: sv };
    await db().query("update lesson set current_version_id = $2 where id = $1", [lesson_id, sid]);
  }
  return out;
}

/** The reviewer's SCR-10 trail: every resolvable blocking finding as an `issue` row, resolved or still open. */
async function recordBlocking(lesson_id: string, hash: string, resolved: boolean): Promise<void> {
  let i = 0;
  for (const f of WP3_BLOCKING) {
    i += 1;
    await insert_row(q, "issue", {
      id: `iss_e2e_${randomBytes(4).toString("hex")}_${i}`, lesson_id, content_hash: hash, level: "blocking", kind: f.kind, message: f.message,
      address: f.address.replace("G6.U4.FLEX-1a", lesson_id), code: f.code, resolved_by: null,
      resolution_reason: resolved ? "e2e: resolved by the reviewer before submit" : null, resolved_at: resolved ? new Date().toISOString() : null,
    });
  }
}

/** The dependency Lesson 4 -> Lesson 5 on the unit's outline version (lesson_link is not copied by NL-99's ensureOutline). */
export async function linkDependant(unit_id: string): Promise<void> {
  const ov = `${unit_id}.ov1`;
  await db().query(
    "insert into lesson_link (outline_version_id, from_lesson_id, to_lesson_id, kind, slot_id) values ($1,$2,$3,'homework_text',$4)",
    [ov, `${unit_id}.L${DEPENDANT}`, `${unit_id}.L${SOURCE}`, slotOf(unit_id)],
  );
  expect(await db().count("lesson_link", "outline_version_id = $1 and from_lesson_id = $2", [ov, `${unit_id}.L${DEPENDANT}`])).toBe(1);
}

/** WP-1: seeded as NL-99 does, for the refusals where it is never approvable. */
export { WP1 };

/** A distinctive review time for the reviewer: 466 s is 7.77 minutes (AC-11). Never printed with a name. */
export const DISTINCT_SECONDS = 466;
export const DISTINCT_MINUTES = "7.77";
export async function seedReviewTime(reviewer: TestUser, lesson: SeededLesson): Promise<void> {
  const version_id = lesson.snapshot?.version_id ?? "lv_none";
  await db().query(
    "insert into review_session (user_id, lesson_id, version_id, started_at, last_at, active_seconds, synthetic) values ($1,$2,$3, now() - interval '20 minutes', now() - interval '10 minutes', $4, false)",
    [reviewer.user_id, lesson.lesson_id, version_id, DISTINCT_SECONDS],
  );
  for (let i = 0; i < 3; i++) {
    await db().query("insert into heartbeat (user_id, tab_id, lesson_id, version_id, at, synthetic) values ($1,$2,$3,$4, now() - interval '15 minutes', false)", [
      reviewer.user_id, `tab_e2e_${i}`, lesson.lesson_id, version_id,
    ]);
  }
}

export interface Cast {
  unit: { unit_id: string; unit_key: string };
  reviewer: TestUser;
  approver: TestUser;
  approver2: TestUser;
}
export async function cast(): Promise<Cast> {
  await ensureSeeded();
  const unit = await freshUnit();
  return {
    unit,
    reviewer: await createUser("reviewer", { synthetic: false }),
    approver: await createUser("approver", { synthetic: false }),
    approver2: await createUser("approver", { synthetic: false }),
  };
}
