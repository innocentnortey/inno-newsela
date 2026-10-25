// NL-100 seed child: run with `npx tsx` from the repo root (the repo packages are ESM; Playwright loads e2e as CJS, same reason as support/db-admin.ts).
//   seed-lessons.ts seed <DATABASE_URL>              -> writes the con-11 lessons, prints a manifest as JSON
//   seed-lessons.ts snapshot <DATABASE_URL> <lesson> -> writes one more `submit` snapshot with an edited first-section minutes value (77), prints its version id
// Lessons go in through the real writers: PgLessonDocStore (lesson_doc), PgLessonRepo (versions, snapshots, state).
// SQL is used only for the outline version/rows, the run row and the alignment links, which have no seam yet, and for the two
// deliberate corruptions (schema 99, unknown node), which are the point of AC-5.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Decimal from "decimal.js";
import { compile_draft } from "@ls/core/compile/compile-draft";
import { template_for } from "@ls/core/compile/templates";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { ProvenanceRecord } from "@ls/core/ports/lesson-versions";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import { PgDatabase } from "@ls/db/pool";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { insert_row } from "@ls/db/testing/insert-row";
import { settings_for } from "@ls/db/testing/test-db";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";
import { lesson_to_ydoc } from "@ls/ydoc/convert";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { NormalizedRow } from "@ls/schema/outline";
import type { StoredLesson } from "@ls/schema/lesson";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "../../../../../packages/core/tests/fixtures");
const UNIT = "G6.U4";
const OV = "ov_e2e_nl100";
const ISBN = "9780786838653";
export const MARKUP_SCRIPT = "<script>window.__pwned=1</script>";
export const MARKUP_IMG = "<img src=x onerror=window.__pwned=1>";

const LESSONS = {
  wp1: "G6.U4.L4",
  submitted: "G6.U4.L5",
  approved: "G6.U4.L6",
  reopened: "G6.U4.L7",
  schema99: "G6.U4.L8",
  badnode: "G6.U4.L9",
  markup: "G6.U4.L10",
  missing: "G6.U4.L11",
  fresh: "G6.U4.L12",
  inreview: "G6.U4.L13",
} as const;
type Key = keyof typeof LESSONS;

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const fixture = (n: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, `${n}.json`), "utf8"));

function build_base(
  db_standards: { code: string; text: string }[],
): StoredLesson {
  const draft = LessonDraft.parse(fixture("draft-wp1"));
  const row = NormalizedRow.parse(fixture("row-wp1"));
  const out = compile_draft(draft, {
    row,
    template: template_for("Reading")!,
    unit_id: UNIT as never,
    schema_version: SCHEMA_VERSION,
  });
  const roles: Record<string, "focus" | "supporting"> = {
    "RL.6.1": "focus",
    "RL.6.2": "focus",
    "L.6.4.b": "focus",
  };
  const lesson = structuredClone(out.lesson);
  lesson.front_matter.standards = db_standards.map((s) => ({
    code: s.code,
    role: roles[s.code] ?? "focus",
    origin: "outline",
    official_text: s.text,
    asserted_by: "outline",
    confirmation: null,
  })) as never;
  lesson.text_cards = lesson.text_cards.map((c) => ({ ...c, edition: ISBN }));
  return lesson;
}

function retarget(base: StoredLesson, lesson_id: string): StoredLesson {
  const n = lesson_id.slice(lesson_id.lastIndexOf(".") + 2);
  const text = JSON.stringify(base)
    .replaceAll("G6.U4.L4", lesson_id)
    .replace("Lesson 4:", `Lesson ${n}:`);
  return JSON.parse(text) as StoredLesson;
}

function with_markup(l: StoredLesson): StoredLesson {
  const c = structuredClone(l);
  const first = c.sections[0]!;
  (first.content as { content: unknown[] }).content.push({
    type: "paragraph",
    attrs: { align: null },
    content: [{ type: "text", text: `${MARKUP_SCRIPT} ${MARKUP_IMG}` }],
  });
  return c;
}

async function main(): Promise<void> {
  const [action, url, arg] = process.argv.slice(2);
  if (!url)
    throw new Error(
      "usage: seed-lessons.ts seed|snapshot <DATABASE_URL> [lesson]",
    );
  const db = new PgDatabase(settings_for(url, 4), 4, 5000);
  const ids = new PrefixedIdGenerator();
  const clock = new SystemClock();
  const repo = new PgLessonRepo({ db, ids, clock });
  try {
    if (action === "snapshot") {
      const out = await snapshot(db, repo, arg ?? "");
      process.stdout.write(JSON.stringify(out));
    } else if (action === "seed") {
      process.stdout.write(JSON.stringify(await seed(db, repo, ids, clock)));
    } else throw new Error(`unknown action ${action}`);
  } finally {
    await db.close();
  }
}

async function snapshot(
  db: PgDatabase,
  repo: PgLessonRepo,
  lesson_id: string,
): Promise<{ version_id: string; content_hash: string }> {
  const prev = await repo.latest_snapshot(lesson_id);
  if (prev === null) throw new Error(`no snapshot for ${lesson_id}`);
  const next: StoredLesson = {
    ...prev.lesson,
    sections: prev.lesson.sections.map((x, i) =>
      i === 0 ? { ...x, minutes: 77 } : x,
    ),
  };
  const bytes = lesson_to_ydoc(next);
  const user = (
    await db.with_tx((tx) =>
      tx.query("select id from app_user where email=$1", [
        "reviewer.demo@example.test",
      ]),
    )
  ).rows[0]?.["id"] as string;
  const row = await db.with_tx((tx) =>
    repo.write_snapshot(
      {
        lesson_id,
        kind: "submit",
        lesson: next,
        content_hash: content_hash(next),
        state_vector: state_vector_of(bytes),
        dependency_record: [],
        created_by: user,
      },
      tx,
    ),
  );
  return { version_id: row.version_id, content_hash: row.content_hash };
}

async function seed(
  db: PgDatabase,
  repo: PgLessonRepo,
  ids: PrefixedIdGenerator,
  clock: SystemClock,
) {
  const store = new PgLessonDocStore({
    db,
    ids,
    clock,
    checks: new PgCheckQueue({ db, ids, clock }),
    states: repo,
    audit: new PgAuditLog({ db, ids, clock }),
  });
  const read = <T>(sql: string, v: unknown[] = []) =>
    db.with_tx(async (tx) => (await tx.query(sql, v)).rows as T[]);

  const stds = await read<{ code: string; text: string }>(
    "select code, text from standard where code = any($1) order by code",
    [["RL.6.1", "RL.6.2", "L.6.4.b"]],
  );
  if (stds.length !== 3)
    throw new Error(
      `standards missing: found ${stds.map((s) => s.code).join(",")} (run stack.seed() first)`,
    );
  const users: Record<string, string> = {};
  for (const r of await read<{ id: string; role: string }>(
    "select id, role from app_user where email like '%.demo@example.test'",
  ))
    users[r.role] = r.id;
  const pv = (
    await read<{ id: string }>(
      "select id from prompt_version order by number limit 1",
    )
  )[0];
  if (!pv || !users["reviewer"] || !users["author"] || !users["approver"])
    throw new Error(
      "demo users or prompt version missing (run stack.seed() first)",
    );

  const base = build_base(stds);
  const seg = (kind: string, text: string, applies = "apply") => ({
    kind,
    text,
    instruction_shaped: false,
    applies,
  });
  const outline_segments = [
    seg(
      "content",
      "Chapter 1 / Focus: pp. 1-8 Teacher Read Aloud - modeling engaging fluency - think alouds",
    ),
    seg(
      "writer_task",
      "Students cite evidence to make inferences and predictions about Percy and his story.",
    ),
    seg(
      "editor_note",
      "Context clues are not foundational skills; think about morphology instead.",
      "show_only",
    ),
  ];
  const row_hash = sha(JSON.stringify(outline_segments));

  await db.with_tx(async (tx) => {
    await tx.query(
      "insert into unit (id, grade, title) values ($1, 6, 'Unit 4') on conflict (id) do nothing",
      [UNIT],
    );
    await insert_row(tx, "outline_version", {
      id: OV,
      unit_id: UNIT,
      number: 1,
      sha256: sha("e2e-outline"),
      same_as_version: null,
      uploaded_by: users["author"],
      confirmed_at: new Date().toISOString(),
    });
    let n = 7;
    for (const [k, id] of Object.entries(LESSONS)) {
      n += 1;
      const num = Number(id.slice(id.lastIndexOf(".") + 2));
      await tx.query(
        `insert into outline_row (outline_version_id, row_number, kind, lesson_id, segments_json, codes_json, findings_json, row_hash)
         values ($1,$2,'lesson',$3,$4::jsonb,$5::jsonb,'[]'::jsonb,$6)`,
        [
          OV,
          n,
          id,
          JSON.stringify(outline_segments),
          JSON.stringify({
            focus_codes: ["RL.6.1", "RL.6.2", "L.6.4.b"],
            eld_codes: [],
            msls_codes: [],
            vocabulary: [],
            meta: {
              number: num,
              title: `Lesson ${num}`,
              lesson_type: "Reading",
              arc: null,
              homework: null,
              pages: null,
              text_set: null,
              key: k,
            },
          }),
          row_hash,
        ],
      );
    }
  });
  const run_id = ids.new_id("run");
  await db.with_tx((tx) =>
    insert_row(tx, "run", {
      id: run_id,
      unit_id: UNIT,
      outline_version_id: OV,
      kind: "unit",
      state: "succeeded",
      prompt_version_id: pv.id,
      started_by: users["author"],
      idempotency_key: "e2e-nl100",
    }),
  );

  const prov = (over: Partial<ProvenanceRecord> = {}): ProvenanceRecord => ({
    outline_row_hash: row_hash as never,
    prompt_version_id: pv.id,
    model: "stub-model-1",
    parameters: { temperature: 0 },
    schema_version: SCHEMA_VERSION,
    example_set_id: "exset_e2e_nl100",
    run_id: run_id as never,
    model_call_ids: [],
    cost_usd: new Decimal("0.42"),
    ai_assisted_spans: 0,
    derived_from_version_id: null,
    ...over,
  });
  const draft = LessonDraft.parse(fixture("draft-wp1"));

  const hashes: Record<string, string> = {};
  const versions: Record<
    string,
    { id: string; number: number; kind: string }[]
  > = {};
  const note = (
    key: string,
    v: { version_id: string; number: number; kind: string },
  ) =>
    (versions[key] ??= []).push({
      id: v.version_id,
      number: v.number,
      kind: v.kind,
    });

  const put_doc = async (lesson: StoredLesson) => {
    const bytes = lesson_to_ydoc(lesson);
    await store.store({
      lesson_id: lesson.lesson_id,
      ydoc_bytes: bytes,
      derived: lesson,
      content_hash: content_hash(lesson),
      state_vector: state_vector_of(bytes),
      stored_by: null,
      request_id: null,
      tag: null,
    });
  };
  const generated = async (
    key: Key,
    lesson: StoredLesson,
    p: ProvenanceRecord = prov(),
  ) => {
    const id = LESSONS[key];
    const w = await db.with_tx((tx) =>
      repo.write_generated_version(
        {
          lesson_id: id,
          unit_id: UNIT as never,
          kind: "generated",
          lesson,
          draft: { ...draft, lesson_id: id } as never,
          content_hash: content_hash(lesson),
          provenance: p,
          idempotency_key: `e2e-nl100-${id}-gen`,
        },
        tx,
      ),
    );
    note(key, w.version);
    return w.version;
  };
  const candidate = async (key: Key, lesson: StoredLesson) => {
    const id = LESSONS[key];
    const w = await db.with_tx((tx) =>
      repo.write_generated_version(
        {
          lesson_id: id,
          unit_id: UNIT as never,
          kind: "candidate",
          lesson,
          draft: { ...draft, lesson_id: id } as never,
          content_hash: content_hash(lesson),
          provenance: prov({ example_set_id: null }),
          idempotency_key: `e2e-nl100-${id}-cand`,
        },
        tx,
      ),
    );
    note(key, w.version);
  };
  const move = async (
    key: Key,
    from: string,
    to: string,
    actor: string,
    version_id: string | null,
    hash: string | null,
    reason: string | null,
  ) => {
    const id = LESSONS[key];
    await db.with_tx(async (tx) => {
      await repo.append_review_event(
        {
          lesson_id: id,
          version_id,
          from_state: from as never,
          to_state: to as never,
          actor_id: actor,
          reason,
          reason_tag: null,
          note: null,
          content_hash: hash as never,
          request_id: ids.new_id("req"),
        },
        tx,
      );
      await repo.set_state(
        id,
        to as never,
        to === "draft" ? null : users["reviewer"]!,
        tx,
      );
    });
  };
  const snap = async (
    key: Key,
    kind: "submit" | "approve" | "reopen",
    lesson: StoredLesson,
    actor: string,
  ) => {
    const bytes = lesson_to_ydoc(lesson);
    const v = await db.with_tx((tx) =>
      repo.write_snapshot(
        {
          lesson_id: LESSONS[key],
          kind,
          lesson,
          content_hash: content_hash(lesson),
          state_vector: state_vector_of(bytes),
          dependency_record: [],
          created_by: actor,
        },
        tx,
      ),
    );
    note(key, v);
    return v;
  };

  await db.with_tx((tx) =>
    repo.ensure_lessons(
      Object.values(LESSONS).map(
        (id) =>
          ({
            kind: "lesson",
            lesson_id: id,
            number: Number(id.slice(id.lastIndexOf(".") + 2)),
            title: `Lesson ${id.slice(id.lastIndexOf(".") + 2)}`,
            lesson_type: "Reading",
          }) as never,
      ),
      UNIT as never,
      tx,
    ),
  );
  // The ensure above gives generic titles; the stored lesson's title is the truth the read model reports.
  for (const [k, id] of Object.entries(LESSONS)) {
    const l = retarget(base, id);
    await db.with_tx((tx) =>
      tx.query("update lesson set title=$2, type=$3 where id=$1", [
        id,
        l.title,
        l.type,
      ]),
    );
    void k;
  }

  // 1. WP-1: draft, generated v1 + a non-adopted candidate v2.
  const wp1 = retarget(base, LESSONS.wp1);
  await put_doc(wp1);
  await generated("wp1", wp1);
  await candidate("wp1", { ...wp1, title: `${wp1.title} (candidate)` });
  hashes["wp1"] = content_hash(wp1);
  const wp1_hash = content_hash(wp1);
  await db.with_tx(async (tx) => {
    const ins = (
      code: string,
      address: string,
      role: string,
      origin: string,
      by: string,
      confirmed: string | null,
    ) =>
      tx.query(
        "insert into alignment_link (lesson_id, content_hash, code, address, role, origin, asserted_by, confirmed_by) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [LESSONS.wp1, wp1_hash, code, address, role, origin, by, confirmed],
      );
    await ins(
      "RL.6.1",
      "G6.U4.L4.LearningInAction.PartA",
      "I",
      "outline",
      "outline",
      null,
    );
    await ins(
      "RL.6.2",
      "G6.U4.L4.LearningInAction.PartB",
      "A",
      "outline",
      "generator",
      null,
    );
    await ins(
      "L.6.4.b",
      "G6.U4.L4.LiteracyLab",
      "P",
      "outline",
      "reviewer",
      users["reviewer"]!,
    );
  });

  // 2. Submitted: generated v1, submit snapshot v2. (The live document is edited by the spec.)
  const sub = retarget(base, LESSONS.submitted);
  await put_doc(sub);
  const sub_gen = await generated("submitted", sub);
  await move(
    "submitted",
    "draft",
    "in_review",
    users["reviewer"]!,
    null,
    null,
    null,
  );
  const sub_snap = await snap("submitted", "submit", sub, users["reviewer"]!);
  await move(
    "submitted",
    "in_review",
    "submitted",
    users["reviewer"]!,
    sub_snap.version_id,
    sub_snap.content_hash,
    "Ready for approval",
  );
  void sub_gen;

  // 3. Approved: generated, submit, approve.
  const app = retarget(base, LESSONS.approved);
  await put_doc(app);
  await generated("approved", app);
  await move(
    "approved",
    "draft",
    "in_review",
    users["reviewer"]!,
    null,
    null,
    null,
  );
  const a1 = await snap("approved", "submit", app, users["reviewer"]!);
  await move(
    "approved",
    "in_review",
    "submitted",
    users["reviewer"]!,
    a1.version_id,
    a1.content_hash,
    "Ready for approval",
  );
  const a2 = await snap("approved", "approve", app, users["approver"]!);
  await move(
    "approved",
    "submitted",
    "approved",
    users["approver"]!,
    a2.version_id,
    a2.content_hash,
    "Looks right",
  );

  // 4. Reopened: generated, candidate (not adopted), submit, approval, reopen: all five kinds in one list.
  const reo = retarget(base, LESSONS.reopened);
  await put_doc(reo);
  await generated("reopened", reo);
  await candidate("reopened", { ...reo, title: `${reo.title} (candidate)` });
  await move(
    "reopened",
    "draft",
    "in_review",
    users["reviewer"]!,
    null,
    null,
    null,
  );
  const r1 = await snap("reopened", "submit", reo, users["reviewer"]!);
  await move(
    "reopened",
    "in_review",
    "submitted",
    users["reviewer"]!,
    r1.version_id,
    r1.content_hash,
    "Ready for approval",
  );
  const r2 = await snap("reopened", "approve", reo, users["approver"]!);
  await move(
    "reopened",
    "submitted",
    "approved",
    users["approver"]!,
    r2.version_id,
    r2.content_hash,
    "Looks right",
  );
  const r3 = await snap("reopened", "reopen", reo, users["approver"]!);
  await move(
    "reopened",
    "approved",
    "reopened",
    users["approver"]!,
    r3.version_id,
    r3.content_hash,
    "A standard changed",
  );

  // 5. Schema 99: stored by the real store, then the stored schema_version is changed by SQL.
  const s99 = retarget(base, LESSONS.schema99);
  await put_doc(s99);
  await generated("schema99", s99);
  await db.with_tx((tx) =>
    tx.query(
      "update lesson_doc set schema_version=99, derived_json = jsonb_set(derived_json, '{schema_version}', '99') where lesson_id=$1",
      [LESSONS.schema99],
    ),
  );

  // 6. Unknown node type in the stored derived row.
  const bad = retarget(base, LESSONS.badnode);
  await put_doc(bad);
  await generated("badnode", bad);
  await db.with_tx((tx) =>
    tx.query(
      `update lesson_doc set derived_json = jsonb_set(derived_json, '{sections,0,content,content}',
         (derived_json #> '{sections,0,content,content}') || '[{"type":"mystery_block","content":[]}]'::jsonb) where lesson_id=$1`,
      [LESSONS.badnode],
    ),
  );

  // 7. Markup: the two strings are in the live document, in the submit snapshot and in the submit reason (SCR-16 shows the reason).
  const mk = with_markup(retarget(base, LESSONS.markup));
  await put_doc(mk);
  await generated("markup", mk);
  await move(
    "markup",
    "draft",
    "in_review",
    users["reviewer"]!,
    null,
    null,
    null,
  );
  const m1 = await snap("markup", "submit", mk, users["reviewer"]!);
  await move(
    "markup",
    "in_review",
    "submitted",
    users["reviewer"]!,
    m1.version_id,
    m1.content_hash,
    `${MARKUP_SCRIPT} ${MARKUP_IMG}`,
  );

  // 8. Missing provenance: the model-field prompt_version_id is absent from the stored provenance (legal: the column is jsonb).
  const miss = retarget(base, LESSONS.missing);
  await put_doc(miss);
  await generated("missing", miss, {
    ...prov(),
    prompt_version_id: undefined as never,
  });

  // 9. Fresh: a plain draft for the reviewer's first page-open (the one lesson a spec may move to in_review).
  const fresh = retarget(base, LESSONS.fresh);
  await put_doc(fresh);
  await generated("fresh", fresh);

  // 10. In review: already started, so reviewer page-opens in other specs change nothing.
  const inrev = retarget(base, LESSONS.inreview);
  await put_doc(inrev);
  await generated("inreview", inrev);
  await move(
    "inreview",
    "draft",
    "in_review",
    users["reviewer"]!,
    null,
    null,
    null,
  );

  return {
    lessons: LESSONS,
    versions,
    users,
    run_id,
    outline_version_id: OV,
    prompt_version_id: pv.id,
    row_hash,
    wp1_hash,
    isbn: ISBN,
    standards: stds,
  };
}

void main().catch((e) => {
  process.stderr.write(e instanceof Error ? `${e.stack}` : String(e));
  process.exit(1);
});
