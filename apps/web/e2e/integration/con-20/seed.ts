// NL-99 seed: lessons in chosen states through SQL helpers (no UI, no collab). The WP-1 stored lesson is the
// content for every seeded lesson (WP-3 and WP-4 reuse its compiled shape with their own ids and titles).
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { insert_row } from "@ls/db/testing/insert-row";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";
import { lesson_to_ydoc } from "@ls/ydoc/convert";
import { request } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser } from "../support/users";

const ROOT = resolve(__dirname, "../../../../..");
export const WP1 = JSON.parse(readFileSync(resolve(ROOT, "packages/ydoc/tests/fixtures/stored-wp1.json"), "utf8")) as StoredLessonJson;
// Generated once from packages/core/tests/fixtures (draft-wp3 + the issued sheet row) by fixtures/gen-wp3.ts.txt: import.meta in
// the core test builder cannot load under Playwright, so the compiled lesson and its blocking findings are checked in.
export const WP3 = JSON.parse(readFileSync(resolve(__dirname, "fixtures/wp3-lesson.json"), "utf8")) as StoredLessonJson;
const WP3_BLOCKING = JSON.parse(readFileSync(resolve(__dirname, "fixtures/wp3-blocking.json"), "utf8")) as { kind: string; message: string; address: string; code: string | null }[];
export interface StoredLessonJson {
  lesson_id: string;
  title: string;
  schema_version: number;
  type: string;
  sections: { content: PM }[];
  [k: string]: unknown;
}
interface PM {
  type: string;
  text?: string;
  content?: PM[];
}

const q = {
  query: async (text: string, values?: readonly unknown[]) => {
    const rows = await db().query(text, [...(values ?? [])]);
    return { rows, rowCount: rows.length };
  },
};

// Independent word counter for the oracle (same rule as the product: teacher tips are not counted).
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
export const WP1_WORDS = WP1.sections.reduce((s, sec) => s + words(sec.content), 0);

export async function ensureSeeded(): Promise<void> {
  const n = await db().count("standard");
  if (n === 0) await getStack().seed();
}

export interface SeededLesson {
  lesson_id: string;
  unit_id: string;
  unit_key: string;
  lesson_key: string;
  words: number;
  snapshot?: { version_id: string; content_hash: string; state_vector: string };
}

let unitCounter = 0;
export async function freshUnit(fixed?: string): Promise<{ unit_id: string; unit_key: string }> {
  if (fixed) {
    if ((await db().count("unit", "id = $1", [fixed])) === 0) await insert_row(q, "unit", { id: fixed });
    const m = /^G(\d+)\.U(\d+)$/.exec(fixed)!;
    return { unit_id: fixed, unit_key: `g${m[1]}-u${m[2]}` };
  }
  for (;;) {
    unitCounter += 1;
    const g = 7 + (Math.floor(Math.random() * 90) % 2);
    const u = 10 + ((randomBytes(1)[0]! + unitCounter) % 90);
    const unit_id = `G${g}.U${u}`;
    if ((await db().count("unit", "id = $1", [unit_id])) === 0) {
      await insert_row(q, "unit", { id: unit_id });
      return { unit_id, unit_key: `g${g}-u${u}` };
    }
  }
}

export interface LessonOpts {
  unit: { unit_id: string; unit_key: string };
  number: number;
  state: "in_review" | "submitted" | "draft";
  // "wp1": the WP-1 stored fixture (flawed on purpose, never approvable). "wp3": the compiled WP-3 flex-day draft,
  // whose only blocking findings are resolvable ones; they are recorded as resolved so the lesson can be approved.
  content?: "wp1" | "wp3";
  title?: string;
  reviewer_id?: string | null;
  last_editor_id?: string | null;
  /** NL-110: edit the lesson before it is stored, so its content_hash carries the edit. */
  mutate?: (lesson: StoredLessonJson) => void;
}

export async function seedLesson(o: LessonOpts): Promise<SeededLesson> {
  const flex = o.content === "wp3";
  const number = flex ? 99 : o.number; // the WP-3 outline row (a flex day) is copied as L99: web keys only know F1..F9, API ids only FLEX-1a
  const lesson_id = `${o.unit.unit_id}.L${number}`;
  await ensureOutline(o.unit.unit_id);
  const base = flex ? (WP3) : WP1;
  const renamed = JSON.parse(JSON.stringify(base).replaceAll("G6.U4.FLEX-1a", lesson_id)) as StoredLessonJson; // addresses carry the lesson id
  const lesson = { ...renamed, lesson_id, title: o.title ?? `${base.title} (seed ${o.number})` };
  o.mutate?.(lesson);
  const total = flex ? base.sections.reduce((n, sec) => n + words(sec.content), 0) : WP1_WORDS;
  const vid = `lv_e2e_${randomBytes(5).toString("hex")}`;
  await insert_row(q, "lesson", {
    id: lesson_id, unit_id: o.unit.unit_id, number, type: base.type, title: lesson.title, state: o.state,
    current_version_id: vid, reviewer_id: o.reviewer_id ?? null, last_editor_id: o.last_editor_id ?? null, schema_version: 1,
  });
  const prov = {
    outline_row_hash: "a".repeat(64), prompt_version_id: "pv_e2e", model: "stub", parameters: {}, schema_version: 1,
    example_set_id: null, run_id: null, model_call_ids: [], cost_usd: "0", ai_assisted_spans: 0, derived_from_version_id: null,
  };
  await insert_row(q, "lesson_version", {
    id: vid, lesson_id, number: 1, kind: "generated", adopted: false, content_hash: content_hash(lesson as never),
    state_vector: null, lesson_json: JSON.stringify(lesson), draft_json: "{}", teacher_word_count: total,
    provenance_json: JSON.stringify(prov), model_call_ids: "[]", dependency_record_json: "[]",
  });
  const bytes = lesson_to_ydoc(lesson as never);
  const hash = content_hash(lesson as never);
  const sv = state_vector_of(bytes);
  await insert_row(q, "lesson_doc", {
    lesson_id, seq: 1, store_id: `st_e2e_${randomBytes(5).toString("hex")}`, ydoc_bytes: Buffer.from(bytes),
    derived_json: JSON.stringify(lesson), content_hash: hash, state_vector: Buffer.from(sv, "base64"), schema_version: 1,
  });
  const out: SeededLesson = { lesson_id, unit_id: o.unit.unit_id, unit_key: o.unit.unit_key, lesson_key: `L${number}`, words: total };
  if (flex) await resolveBlocking(lesson_id, lesson);
  if (o.state === "submitted") {
    const sid = `lv_e2e_${randomBytes(5).toString("hex")}`;
    await insert_row(q, "lesson_version", {
      id: sid, lesson_id, number: 2, kind: "submit", adopted: false, content_hash: hash, state_vector: Buffer.from(sv, "base64"),
      lesson_json: JSON.stringify(lesson), draft_json: null, teacher_word_count: total,
      provenance_json: JSON.stringify({ ...prov, derived_from_version_id: vid }), derived_from_version_id: vid,
      model_call_ids: "[]", dependency_record_json: "[]",
    });
    out.snapshot = { version_id: sid, content_hash: hash, state_vector: sv };
  }
  return out;
}

const TEMPLATE_UNIT = "G6.U4";

// The approval checks compare a lesson with its outline row, so every seeded unit needs an outline version. The issued
// sheet is uploaded once through the real route (as a throwaway author); each seeded unit gets a copy of its rows with
// the unit prefix rewritten, which keeps the row for lesson L4 (WP-1) matching WP-1's content.
async function templateVersion(): Promise<string> {
  const have = await db().query<{ id: string }>("select id from outline_version where unit_id = $1 order by number limit 1", [TEMPLATE_UNIT]);
  if (have[0]) return have[0].id;
  const author = await createUser("author", { synthetic: true });
  const api = await request.newContext({ baseURL: getStack().baseURL, extraHTTPHeaders: { Origin: getStack().baseURL } });
  const login = await api.post("/api/session", { data: { email: author.email, password: author.password } });
  if (login.status() !== 200) throw new Error(`template login failed: ${login.status()}`);
  const bytes = readFileSync(resolve(ROOT, "packages/core/tests/fixtures/outline/issued.xlsx"));
  const up = await api.post("/api/outline-versions", {
    multipart: { file: { name: "issued.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes } },
  });
  if (up.status() !== 201) throw new Error(`template upload failed: ${up.status()} ${await up.text()}`);
  const id = ((await up.json()) as { outline_version_id: string }).outline_version_id;
  await api.dispose();
  return id;
}

export async function ensureOutline(unit_id: string): Promise<void> {
  if ((await db().count("outline_version", "unit_id = $1", [unit_id])) > 0) return;
  const tpl = await templateVersion();
  const ver = `${unit_id}.ov1`;
  const prefix = "^" + TEMPLATE_UNIT.replace(".", "\\.") + "\\.";
  await db().query(
    `insert into outline_version (id, unit_id, number, sha256, same_as_version, source_kind, source_name, uploaded_by, confirmed_at)
     select $1, $2, 1, sha256, null, source_kind, source_name, uploaded_by, now() from outline_version where id = $3`,
    [ver, unit_id, tpl],
  );
  await db().query(
    `insert into outline_row (outline_version_id, row_number, kind, lesson_id, segments_json, codes_json, findings_json, row_hash)
     select $1, row_number, kind, replace(regexp_replace(lesson_id, $3, $2), 'FLEX-1a', 'L99'), segments_json, codes_json, findings_json, row_hash
       from outline_row where outline_version_id = $4`,
    [ver, `${unit_id}.`, prefix, tpl],
  );
}

// A reviewer resolving every resolvable blocking finding on SCR-10 leaves `issue` rows with resolved_at set.
async function resolveBlocking(lesson_id: string, lesson: StoredLessonJson): Promise<void> {
  const findings = WP3_BLOCKING;
  const hash = content_hash(lesson as never);
  let i = 0;
  for (const f of findings) {
    i += 1;
    await insert_row(q, "issue", {
      id: `iss_e2e_${randomBytes(4).toString("hex")}_${i}`, lesson_id, content_hash: hash, level: "blocking", kind: f.kind, message: f.message,
      address: f.address.replace("G6.U4.FLEX-1a", lesson_id), code: f.code, resolved_by: null,
      resolution_reason: "e2e: resolved by the reviewer before submit", resolved_at: new Date().toISOString(),
    });
  }
}
