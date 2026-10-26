import Decimal from "decimal.js";
import { DomainRefusal, InvariantViolation } from "@ls/core/errors";
import type { Clock } from "@ls/core/ports/clock";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { Tx } from "@ls/core/ports/tx";
import type { DependencyState, LessonGraphRepo } from "@ls/core/ports/lesson-graph";
import type { LessonRow, LessonStateInfo, LessonStateRepo, NewReviewEvent, ReviewEventRow } from "@ls/core/ports/lesson-state";
import type {
  GeneratedVersionWrite,
  LessonVersionRepo,
  LessonVersionRow,
  NewGeneratedVersion,
  NewSnapshot,
  ProvenanceRecord,
} from "@ls/core/ports/lesson-versions";
import type { LessonId, LessonStateName, OutlineVersionId, UnitId, UserId, VersionId } from "@ls/core/ports/common";
import { is_editable } from "@ls/core/lifecycle/lesson-machine";
import type { LessonState } from "@ls/schema/api/board";
import type { NormalizedRow } from "@ls/schema/outline";
import type { StoredLesson } from "@ls/schema/lesson";
import { slot_state_of } from "@ls/core/checks/rules/links/slots";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg rows are untyped; mapped at the edge
type Row = Record<string, any>;

interface PMNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
}

function assert_tx(tx: Tx): DbTx {
  if (!(tx instanceof DbTx)) throw new InvariantViolation("lesson repo needs a real transaction");
  return tx;
}

function row_to_lesson(r: Row): LessonRow {
  return {
    lesson_id: r["id"],
    unit_id: r["unit_id"],
    number: r["number"],
    type: r["type"],
    title: r["title"],
    state: r["state"],
    current_version_id: r["current_version_id"],
    reviewer_id: r["reviewer_id"],
    last_editor_id: r["last_editor_id"],
    reviewer_name: r["reviewer_name"] ?? null,
    last_editor_name: r["last_editor_name"] ?? null,
    schema_version: r["schema_version"],
  };
}

function row_to_version(r: Row): LessonVersionRow {
  const p = r["provenance_json"] as Row;
  return {
    version_id: r["id"],
    lesson_id: r["lesson_id"],
    number: r["number"],
    kind: r["kind"],
    adopted: r["adopted"],
    content_hash: r["content_hash"],
    state_vector: r["state_vector"] ? (r["state_vector"] as Buffer).toString("base64") : null,
    lesson: r["lesson_json"],
    draft: r["draft_json"],
    teacher_word_count: r["teacher_word_count"],
    provenance: {
      ...p,
      cost_usd: new Decimal(p["cost_usd"]),
      run_id: r["run_id"],
      model_call_ids: r["model_call_ids"],
      derived_from_version_id: r["derived_from_version_id"],
    } as ProvenanceRecord,
    dependency_record: r["dependency_record_json"],
    created_by: r["created_by"],
    stored_at: r["stored_at"],
  } as LessonVersionRow;
}

function inline_text(n: PMNode): string {
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hard_break") return " ";
  return (n.content ?? []).map(inline_text).join("");
}

// Local copy of the private counter in core/src/compile/compile-draft.ts.
function count_words(n: PMNode): number {
  if (n.type === "teacher_tip") return 0;
  const kids = n.content ?? [];
  const has_inline = kids.some((k) => k.type === "text" || k.type === "hard_break");
  if (has_inline) return (inline_text(n).match(/\S+/g) ?? []).length;
  return kids.reduce((s, k) => s + count_words(k), 0);
}

function count_words_total(lesson: StoredLesson): number {
  return lesson.sections.reduce((s, sec) => s + count_words(sec.content as PMNode), 0);
}

function slot_is_filled(derived: unknown, slot_id: string): boolean {
  const sections = (derived as { sections?: { content?: unknown }[] } | null)?.sections;
  if (!Array.isArray(sections)) return false;
  const typed = sections.filter((s) => s.content !== undefined) as unknown as Parameters<typeof slot_state_of>[0];
  return slot_state_of(typed, slot_id) === "filled";
}

const SOURCE_FILTER = `(kind='generated' OR (kind='candidate' AND adopted))`;

export class PgLessonRepo implements LessonStateRepo, LessonVersionRepo, LessonGraphRepo {
  private readonly db: PgDatabase;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.ids = deps.ids;
    this.clock = deps.clock;
  }

  private async read<R extends Row>(sql: string, values: readonly unknown[]): Promise<R[]> {
    return this.db.with_tx(async (tx) => (await tx.query<R>(sql, values)).rows);
  }

  // ---- LessonStateRepo ----

  /** Current state of each lesson id: one query for any number of ids (collab S-29 sweep). Absent id = no such lesson. */
  async states_of(lesson_ids: LessonId[]): Promise<Map<LessonId, LessonStateName>> {
    if (lesson_ids.length === 0) return new Map();
    const rows = await this.read<{ id: string; state: LessonStateName }>(
      "SELECT id, state FROM lesson WHERE id = ANY($1::text[])",
      [lesson_ids],
    );
    return new Map(rows.map((r) => [r.id as LessonId, r.state]));
  }

  async get(lesson_id: LessonId): Promise<LessonRow | null> {
    const rows = await this.read(`SELECT l.*, r.name AS reviewer_name, e.name AS last_editor_name FROM lesson l
       LEFT JOIN app_user r ON r.id = l.reviewer_id
       LEFT JOIN app_user e ON e.id = l.last_editor_id
       WHERE l.id=$1`,
      [lesson_id],
    );
    return rows[0] ? row_to_lesson(rows[0]) : null;
  }

  async lock_for_update(lesson_id: LessonId, tx: Tx): Promise<LessonRow> {
    const t = assert_tx(tx);
    const { rows } = await t.query("SELECT * FROM lesson WHERE id=$1 FOR UPDATE", [lesson_id]);
    if (!rows[0]) throw new DomainRefusal("NOT_FOUND", "lesson not found", { lesson_id });
    return row_to_lesson(rows[0]);
  }

  async state_of(lesson_id: LessonId): Promise<LessonStateInfo> {
    const row = await this.get(lesson_id);
    if (!row) throw new DomainRefusal("NOT_FOUND", "lesson not found", { lesson_id });
    return {
      lesson_id,
      state: row.state,
      editable: is_editable(row.state as LessonState, "reviewer"),
      reviewer_id: row.reviewer_id,
    };
  }

  async ensure_lessons(rows: readonly NormalizedRow[], unit_id: UnitId, tx: Tx): Promise<number> {
    const t = assert_tx(tx);
    let created = 0;
    for (const r of rows) {
      if ((r.kind !== "lesson" && r.kind !== "flex_day") || r.lesson_id === null) continue;
      const res = await t.query(
        `INSERT INTO lesson (id, unit_id, number, type, title, state, schema_version)
         VALUES ($1,$2,$3,$4,$5,'draft',$6) ON CONFLICT (id) DO NOTHING RETURNING id`,
        [r.lesson_id, unit_id, r.number, r.lesson_type, r.title, SCHEMA_VERSION],
      );
      created += res.rows.length;
    }
    return created;
  }

  async set_state(lesson_id: LessonId, to_state: LessonStateName, reviewer_id: UserId | null, tx: Tx): Promise<LessonRow> {
    const t = assert_tx(tx);
    const { rows } = await t.query("UPDATE lesson SET state=$2, reviewer_id=$3 WHERE id=$1 RETURNING *", [
      lesson_id,
      to_state,
      reviewer_id,
    ]);
    if (!rows[0]) throw new DomainRefusal("NOT_FOUND", "lesson not found", { lesson_id });
    return row_to_lesson(rows[0]);
  }

  async append_review_event(e: NewReviewEvent, tx: Tx): Promise<ReviewEventRow> {
    const t = assert_tx(tx);
    const id = this.ids.new_id("ev");
    const at = this.clock.now();
    await t.query(
      `INSERT INTO review_event (id, lesson_id, version_id, from_state, to_state, actor_id, reason, reason_tag, note, content_hash, request_id, at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, e.lesson_id, e.version_id, e.from_state, e.to_state, e.actor_id, e.reason, e.reason_tag, e.note, e.content_hash, e.request_id, at],
    );
    return { review_event_id: id, lesson_id: e.lesson_id, from_state: e.from_state, to_state: e.to_state, actor_id: e.actor_id, at };
  }

  async record_last_editor(lesson_id: LessonId, user_id: UserId, tx: Tx): Promise<void> {
    const t = assert_tx(tx);
    const res = await t.query("UPDATE lesson SET last_editor_id=$2 WHERE id=$1", [lesson_id, user_id]);
    if (res.rowCount === 0) throw new DomainRefusal("NOT_FOUND", "lesson not found", { lesson_id });
  }

  // ---- LessonVersionRepo ----

  private async lock_lesson(t: DbTx, lesson_id: LessonId): Promise<void> {
    const { rows } = await t.query("SELECT id FROM lesson WHERE id=$1 FOR UPDATE", [lesson_id]);
    if (!rows[0]) throw new InvariantViolation("lesson missing", { lesson_id });
  }

  private async next_number(t: DbTx, lesson_id: LessonId): Promise<number> {
    const { rows } = await t.query("SELECT COALESCE(MAX(number),0)+1 AS n FROM lesson_version WHERE lesson_id=$1", [lesson_id]);
    return Number(rows[0]?.["n"]);
  }

  async write_generated_version(v: NewGeneratedVersion, tx: Tx): Promise<GeneratedVersionWrite> {
    const t = assert_tx(tx);
    if (v.kind !== "generated" && v.kind !== "candidate") {
      throw new InvariantViolation("generated version kind invalid", { kind: v.kind });
    }
    await this.lock_lesson(t, v.lesson_id);
    const number = await this.next_number(t, v.lesson_id);
    const p = v.provenance;
    const res = await t.query(
      `INSERT INTO lesson_version (id, lesson_id, number, kind, adopted, content_hash, state_vector, lesson_json, draft_json,
         teacher_word_count, provenance_json, derived_from_version_id, run_id, model_call_ids, dependency_record_json,
         created_by, stored_at, idempotency_key)
       VALUES ($1,$2,$3,$4,false,$5,NULL,$6::jsonb,$7::jsonb,$8,$9::jsonb,$10,$11,$12::jsonb,'[]'::jsonb,NULL,$13,$14)
       ON CONFLICT ON CONSTRAINT lesson_version_idempotency_key_key DO NOTHING RETURNING *`,
      [
        this.ids.new_id("lv"),
        v.lesson_id,
        number,
        v.kind,
        v.content_hash,
        JSON.stringify(v.lesson),
        JSON.stringify(v.draft),
        count_words_total(v.lesson),
        JSON.stringify({ ...p, cost_usd: p.cost_usd.toString() }),
        p.derived_from_version_id,
        p.run_id,
        JSON.stringify(p.model_call_ids),
        this.clock.now(),
        v.idempotency_key,
      ],
    );
    if (res.rows[0]) {
      if (v.kind === "generated") {
        await t.query("UPDATE lesson SET current_version_id=$2 WHERE id=$1", [v.lesson_id, res.rows[0]["id"]]);
      }
      return { version: row_to_version(res.rows[0]), created: true };
    }
    const existing = await t.query("SELECT * FROM lesson_version WHERE idempotency_key=$1", [v.idempotency_key]);
    return { version: row_to_version(existing.rows[0] as Row), created: false };
  }

  async write_snapshot(s: NewSnapshot, tx: Tx): Promise<LessonVersionRow> {
    const t = assert_tx(tx);
    if (!["submit", "approve", "reopen"].includes(s.kind)) {
      throw new InvariantViolation("snapshot kind invalid", { kind: s.kind });
    }
    await this.lock_lesson(t, s.lesson_id);
    const src = (
      await t.query(
        `SELECT * FROM lesson_version WHERE lesson_id=$1 AND ${SOURCE_FILTER} ORDER BY number DESC LIMIT 1`,
        [s.lesson_id],
      )
    ).rows[0];
    if (!src) throw new InvariantViolation("no generated version to descend from", { lesson_id: s.lesson_id });
    const sp = src["provenance_json"] as Row;
    const number = await this.next_number(t, s.lesson_id);
    const provenance = {
      outline_row_hash: sp["outline_row_hash"],
      prompt_version_id: sp["prompt_version_id"],
      schema_version: sp["schema_version"],
      run_id: sp["run_id"],
      model: null,
      parameters: {},
      example_set_id: null,
      model_call_ids: [],
      cost_usd: "0",
      ai_assisted_spans: 0,
      derived_from_version_id: src["id"],
    };
    const res = await t.query(
      `INSERT INTO lesson_version (id, lesson_id, number, kind, adopted, content_hash, state_vector, lesson_json, draft_json,
         teacher_word_count, provenance_json, derived_from_version_id, run_id, model_call_ids, dependency_record_json,
         created_by, stored_at, idempotency_key)
       VALUES ($1,$2,$3,$4,false,$5,$6,$7::jsonb,NULL,$8,$9::jsonb,$10,$11,'[]'::jsonb,$12::jsonb,$13,$14,NULL)
       RETURNING *`,
      [
        this.ids.new_id("lv"),
        s.lesson_id,
        number,
        s.kind,
        s.content_hash,
        Buffer.from(s.state_vector, "base64"),
        JSON.stringify(s.lesson),
        count_words_total(s.lesson),
        JSON.stringify(provenance),
        src["id"],
        src["run_id"],
        JSON.stringify(s.dependency_record),
        s.created_by,
        this.clock.now(),
      ],
    );
    return row_to_version(res.rows[0] as Row);
  }

  private async one_version(sql: string, values: readonly unknown[]): Promise<LessonVersionRow | null> {
    const rows = await this.read(sql, values);
    return rows[0] ? row_to_version(rows[0]) : null;
  }

  version(version_id: VersionId): Promise<LessonVersionRow | null> {
    return this.one_version("SELECT * FROM lesson_version WHERE id=$1", [version_id]);
  }

  latest_snapshot(lesson_id: LessonId): Promise<LessonVersionRow | null> {
    return this.one_version(
      "SELECT * FROM lesson_version WHERE lesson_id=$1 AND kind IN ('submit','approve','reopen') ORDER BY number DESC LIMIT 1",
      [lesson_id],
    );
  }

  // S-37: a candidate that became the lesson's v1 is stored as kind='generated'; reads must still find it.
  candidate(lesson_id: LessonId, candidate_id: VersionId): Promise<LessonVersionRow | null> {
    return this.one_version("SELECT * FROM lesson_version WHERE id=$2 AND lesson_id=$1 AND kind IN ('candidate','generated')", [lesson_id, candidate_id]);
  }

  async has_generated_version(lesson_id: LessonId): Promise<boolean> {
    const rows = await this.read("SELECT EXISTS (SELECT 1 FROM lesson_version WHERE lesson_id=$1 AND kind='generated') AS e", [lesson_id]);
    return rows[0]?.["e"] === true;
  }

  async approved_snapshots(unit_id: UnitId): Promise<LessonVersionRow[]> {
    const rows = await this.read(
      `SELECT v.* FROM lesson l
       JOIN LATERAL (SELECT * FROM lesson_version WHERE lesson_id=l.id AND kind='approve' ORDER BY number DESC LIMIT 1) v ON true
       WHERE l.unit_id=$1 AND l.state IN ('approved','exported')
       ORDER BY l.number NULLS LAST, l.id`,
      [unit_id],
    );
    return rows.map(row_to_version);
  }

  async mark_adopted(version_id: VersionId, tx: Tx): Promise<LessonVersionRow> {
    const t = assert_tx(tx);
    const { rows } = await t.query(
      "UPDATE lesson_version SET adopted=true WHERE id=$1 AND kind='candidate' AND adopted=false RETURNING *",
      [version_id],
    );
    if (!rows[0]) {
      throw new DomainRefusal("INVALID_TRANSITION", "candidate already adopted or not a candidate", { version_id });
    }
    return row_to_version(rows[0]);
  }

  // ---- LessonGraphRepo ----

  // Links of the newest outline version of the lesson's unit.
  private static readonly LINKS = `
    FROM lesson_link k
    WHERE k.outline_version_id = (
      SELECT ov.id FROM outline_version ov
      WHERE ov.unit_id = (SELECT unit_id FROM lesson WHERE id=$1) ORDER BY ov.number DESC LIMIT 1)`;

  async dependencies(lesson_id: LessonId): Promise<DependencyState[]> {
    const links = await this.read<Row>(
      `SELECT k.id, k.from_lesson_id, k.to_lesson_id, k.slot_id ${PgLessonRepo.LINKS}
         AND (k.from_lesson_id=$1 OR k.to_lesson_id=$1) ORDER BY k.id`,
      [lesson_id],
    );
    const out: DependencyState[] = [];
    for (const k of links) {
      const waits = k["from_lesson_id"] === lesson_id;
      const source: LessonId = k["to_lesson_id"];
      const src = (
        await this.read<Row>(
          `SELECT l.state,
             (SELECT content_hash FROM lesson_version WHERE lesson_id=l.id AND kind='approve' ORDER BY number DESC LIMIT 1) AS approved_hash,
             (SELECT derived_json FROM lesson_doc WHERE lesson_id=l.id ORDER BY seq DESC LIMIT 1) AS derived
           FROM lesson l WHERE l.id=$1`,
          [source],
        )
      )[0];
      const state: LessonStateName = src?.["state"] ?? "draft";
      const approved = state === "approved" || state === "exported";
      out.push({
        direction: waits ? "waits_on" : "depended_on_by",
        lesson_id: waits ? k["to_lesson_id"] : k["from_lesson_id"],
        slot_id: k["slot_id"],
        source_state: state,
        slot_filled: src ? slot_is_filled(src["derived"], k["slot_id"]) : false,
        source_approved_hash: approved ? (src?.["approved_hash"] ?? null) : null,
      });
    }
    return out;
  }

  async dependants(lesson_id: LessonId): Promise<LessonId[]> {
    const rows = await this.read<Row>(
      `SELECT DISTINCT k.from_lesson_id ${PgLessonRepo.LINKS} AND k.to_lesson_id=$1 ORDER BY k.from_lesson_id`,
      [lesson_id],
    );
    return rows.map((r) => r["from_lesson_id"]);
  }

  async source_outline_version(lesson_id: LessonId): Promise<OutlineVersionId | null> {
    const rows = await this.read<Row>(
      `SELECT r.outline_version_id FROM (
         SELECT run_id FROM lesson_version WHERE lesson_id=$1 AND ${SOURCE_FILTER} ORDER BY number DESC LIMIT 1) v
       LEFT JOIN run r ON r.id = v.run_id`,
      [lesson_id],
    );
    return rows[0]?.["outline_version_id"] ?? null;
  }
}
