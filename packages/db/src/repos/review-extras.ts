// NL-43: safety-flag, alignment-link and suggestion repositories (DO-4 section 3.5).
// No logging in this file: suggestion text must never reach a log.
import { InvariantViolation } from "@ls/core/errors";
import type { AlignmentLinkRow, AlignmentRepo, CoverageCell } from "@ls/core/ports/alignment";
import type { Clock } from "@ls/core/ports/clock";
import type { LessonId, Sha256, SuggestionId, UnitId, UserId } from "@ls/core/ports/common";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { SafetyFlagRepo, SafetyFlagRow } from "@ls/core/ports/safety-flags";
import type { NewSuggestion, SuggestionRepo, SuggestionRow } from "@ls/core/ports/suggestions";
import type { Tx } from "@ls/core/ports/tx";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";

function real_tx(tx: Tx): DbTx {
  if (!(tx instanceof DbTx)) throw new InvariantViolation("repository write needs a real transaction");
  return tx;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg rows are untyped; each mapper names its columns
type Row = Record<string, any>;

// ---------------------------------------------------------------- safety flags

function flag_row(r: Row): SafetyFlagRow {
  return {
    flag_id: r["id"], lesson_id: r["lesson_id"], source_row: r["source_row"], teacher_tip_address: r["teacher_tip_address"],
    status: r["status"], cleared_by: r["cleared_by"], note: r["note"], cleared_at: r["cleared_at"],
  };
}

export class PgSafetyFlagRepo implements SafetyFlagRepo {
  private readonly db: PgDatabase;
  private readonly clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.clock = deps.clock;
  }

  // The deterministic id is the idempotency key: one flag per (lesson, source row), ever.
  async create_for_lesson(lesson_id: LessonId, source_rows: readonly number[], tx: Tx): Promise<SafetyFlagRow[]> {
    const t = real_tx(tx);
    const created: SafetyFlagRow[] = [];
    for (const source_row of [...new Set(source_rows)]) {
      const res = await t.query<Row>(
        `INSERT INTO safety_flag (id, lesson_id, source_row, teacher_tip_address, status, cleared_by, note, cleared_at)
         VALUES ($1,$2,$3,NULL,'open',NULL,NULL,NULL) ON CONFLICT (id) DO NOTHING RETURNING *`,
        [`sf:${lesson_id}:${source_row}`, lesson_id, source_row],
      );
      for (const r of res.rows) created.push(flag_row(r));
    }
    return created;
  }

  async open_for(lesson_id: LessonId): Promise<SafetyFlagRow[]> {
    const rows = await this.db.with_tx(
      async (tx) => (await tx.query<Row>(`SELECT * FROM safety_flag WHERE lesson_id=$1 AND status='open' ORDER BY source_row, id`, [lesson_id])).rows,
    );
    return rows.map(flag_row);
  }

  async clear(flag_id: string, by: UserId, note: string, tx: Tx): Promise<SafetyFlagRow> {
    if (note.trim() === "") throw new InvariantViolation("safety flag note required", { flag_id });
    const t = real_tx(tx);
    const res = await t.query<Row>(
      `UPDATE safety_flag SET status='cleared', cleared_by=$2, note=$3, cleared_at=$4::timestamptz
       WHERE id=$1 AND status='open' RETURNING *`,
      [flag_id, by, note, this.clock.now().toISOString()],
    );
    if (res.rows[0]) return flag_row(res.rows[0]);
    const cur = await t.query<Row>(`SELECT status FROM safety_flag WHERE id=$1`, [flag_id]);
    if (!cur.rows[0]) throw new InvariantViolation("safety flag not found", { flag_id });
    throw new InvariantViolation("safety flag already cleared", { flag_id });
  }
}

// ------------------------------------------------------------------- alignment

const LATEST_HASH = "(SELECT content_hash FROM lesson_doc WHERE lesson_id = $1 ORDER BY seq DESC LIMIT 1)";

function link_row(r: Row): AlignmentLinkRow {
  return {
    lesson_id: r["lesson_id"], content_hash: r["content_hash"], code: r["code"], address: r["address"], role: r["role"],
    origin: r["origin"], asserted_by: r["asserted_by"], confirmed_by: r["confirmed_by"],
  };
}

const INSERT_LINK = `INSERT INTO alignment_link (lesson_id, content_hash, code, address, role, origin, asserted_by, confirmed_by)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`;

const COVERAGE_SQL = `
WITH ls AS (SELECT id FROM lesson WHERE unit_id = $1),
approved AS (
  SELECT DISTINCT ON (v.lesson_id) v.lesson_id, v.content_hash
    FROM lesson_version v JOIN ls ON ls.id = v.lesson_id
   WHERE v.kind = 'approve' ORDER BY v.lesson_id, v.number DESC),
working AS (
  SELECT DISTINCT ON (d.lesson_id) d.lesson_id, d.content_hash
    FROM lesson_doc d JOIN ls ON ls.id = d.lesson_id
   ORDER BY d.lesson_id, d.seq DESC),
chosen AS (
  SELECT ls.id AS lesson_id,
         COALESCE(a.content_hash, w.content_hash) AS content_hash,
         CASE WHEN a.content_hash IS NOT NULL THEN 'approved' ELSE 'working' END AS source
    FROM ls LEFT JOIN approved a ON a.lesson_id = ls.id LEFT JOIN working w ON w.lesson_id = ls.id)
SELECT al.code, al.lesson_id, al.role, c.source,
       bool_or(al.confirmed_by IS NOT NULL OR al.asserted_by = 'reviewer') AS person,
       bool_or(al.asserted_by = 'judge') AS judged
  FROM alignment_link al
  JOIN chosen c ON c.lesson_id = al.lesson_id AND c.content_hash = al.content_hash
 GROUP BY al.code, al.lesson_id, al.role, c.source
 ORDER BY al.code, al.lesson_id, al.role`;

export class PgAlignmentRepo implements AlignmentRepo {
  private readonly db: PgDatabase;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
  }

  private async current_hash(tx: DbTx, lesson_id: LessonId): Promise<string> {
    const res = await tx.query<Row>(`SELECT ${LATEST_HASH} AS h`, [lesson_id]);
    const h = res.rows[0]?.["h"];
    if (typeof h !== "string") throw new InvariantViolation("lesson has no stored document", { lesson_id });
    return h;
  }

  async replace_for_hash(lesson_id: LessonId, content_hash: Sha256, links: readonly AlignmentLinkRow[], tx: Tx): Promise<number> {
    for (const l of links) {
      if (l.lesson_id !== lesson_id || l.content_hash !== content_hash) throw new InvariantViolation("alignment link does not match lesson and hash", { lesson_id });
    }
    const t = real_tx(tx);
    // Confirmation follows an identical (code, address, origin) from the most recent earlier hash.
    const prior = await t.query<Row>(
      `SELECT code, address, origin, confirmed_by FROM alignment_link a
       WHERE lesson_id=$1 AND content_hash<>$2 AND confirmed_by IS NOT NULL
       ORDER BY (SELECT max(seq) FROM lesson_doc d WHERE d.lesson_id=a.lesson_id AND d.content_hash=a.content_hash) DESC NULLS LAST`,
      [lesson_id, content_hash],
    );
    const carried = new Map<string, string>();
    for (const r of prior.rows) {
      const key = `${r["code"]}|${r["address"]}|${r["origin"]}`;
      if (!carried.has(key)) carried.set(key, r["confirmed_by"]);
    }
    await t.query(`DELETE FROM alignment_link WHERE lesson_id=$1 AND content_hash=$2`, [lesson_id, content_hash]);
    for (const l of links) {
      const confirmed = l.confirmed_by ?? carried.get(`${l.code}|${l.address}|${l.origin}`) ?? null;
      await t.query(INSERT_LINK, [lesson_id, content_hash, l.code, l.address, l.role, l.origin, l.asserted_by, confirmed]);
    }
    return links.length;
  }

  async for_lesson(lesson_id: LessonId): Promise<AlignmentLinkRow[]> {
    const rows = await this.db.with_tx(
      async (tx) =>
        (await tx.query<Row>(`SELECT * FROM alignment_link WHERE lesson_id=$1 AND content_hash = ${LATEST_HASH} ORDER BY code, address, role`, [lesson_id])).rows,
    );
    return rows.map(link_row);
  }

  async confirm(lesson_id: LessonId, code: string, by: UserId, decision: "confirm" | "remove" | "add", tx: Tx): Promise<AlignmentLinkRow> {
    const t = real_tx(tx);
    const hash = await this.current_hash(t, lesson_id);
    const none = (): never => {
      throw new InvariantViolation("no alignment rows for code", { lesson_id, code });
    };
    if (decision === "add") {
      // The port carries no address or role: the lesson itself is the address, role "P" (NL-43 decision).
      const res = await t.query<Row>(
        `${INSERT_LINK} ON CONFLICT (lesson_id, content_hash, code, address, role)
         DO UPDATE SET origin='added', asserted_by='reviewer', confirmed_by=NULL RETURNING *`,
        [lesson_id, hash, code, lesson_id, "P", "added", "reviewer", null],
      );
      return link_row(res.rows[0] as Row);
    }
    if (decision === "remove") {
      const res = await t.query<Row>(`DELETE FROM alignment_link WHERE lesson_id=$1 AND content_hash=$2 AND code=$3 RETURNING *`, [lesson_id, hash, code]);
      if (res.rows.length === 0) return none();
      return link_row([...res.rows].sort((a, b) => (a["address"] < b["address"] ? -1 : 1))[0] as Row);
    }
    const upd = await t.query<Row>(
      `UPDATE alignment_link SET confirmed_by=$4 WHERE lesson_id=$1 AND content_hash=$2 AND code=$3 AND confirmed_by IS NULL RETURNING *`,
      [lesson_id, hash, code, by],
    );
    const all = await t.query<Row>(`SELECT * FROM alignment_link WHERE lesson_id=$1 AND content_hash=$2 AND code=$3 ORDER BY address`, [lesson_id, hash, code]);
    if (all.rows.length === 0 && upd.rows.length === 0) return none();
    return link_row(all.rows[0] as Row);
  }

  async restore(lesson_id: LessonId, code: string, rows: readonly AlignmentLinkRow[], tx: Tx): Promise<number> {
    for (const r of rows) {
      if (r.lesson_id !== lesson_id || r.code !== code) throw new InvariantViolation("restore row does not match lesson and code", { lesson_id, code });
    }
    const t = real_tx(tx);
    const hash = await this.current_hash(t, lesson_id);
    await t.query(`DELETE FROM alignment_link WHERE lesson_id=$1 AND content_hash=$2 AND code=$3`, [lesson_id, hash, code]);
    for (const r of rows) await t.query(INSERT_LINK, [lesson_id, hash, code, r.address, r.role, r.origin, r.asserted_by, r.confirmed_by]);
    return rows.length;
  }

  async coverage_rows(unit_id: UnitId): Promise<CoverageCell[]> {
    const rows = await this.db.with_tx(async (tx) => (await tx.query<Row>(COVERAGE_SQL, [unit_id])).rows);
    return rows.map((r) => ({
      code: r["code"], lesson_id: r["lesson_id"], role: r["role"], source: r["source"],
      confirmation: r["person"] ? "person" : r["judged"] ? "judge_only" : "generator_only",
    }));
  }
}

// ----------------------------------------------------------------- suggestions

function sug_row(r: Row): SuggestionRow {
  return {
    suggestion_id: r["id"], lesson_id: r["lesson_id"], anchor_start: r["anchor_start"], anchor_end: r["anchor_end"],
    selected_text: r["selected_text"], suggested_text: r["suggested_text"], status: r["status"], requested_by: r["requested_by"],
    decided_by: r["decided_by"], decided_at: r["decided_at"], expires_at: r["expires_at"], model_call_id: r["model_call_id"],
  };
}

export class PgSuggestionRepo implements SuggestionRepo {
  private readonly db: PgDatabase;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.ids = deps.ids;
    this.clock = deps.clock;
  }

  async insert(s: NewSuggestion): Promise<SuggestionRow> {
    const id = this.ids.new_id("sug");
    const row = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query<Row>(
            `INSERT INTO suggestion (id, lesson_id, anchor_start, anchor_end, selected_text, note, suggested_text, status, requested_by, decided_by, decided_at, expires_at, model_call_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,NULL,NULL,$9::timestamptz,$10) RETURNING *`,
            [id, s.lesson_id, s.anchor_start, s.anchor_end, s.selected_text, s.note, s.suggested_text, s.requested_by, s.expires_at.toISOString(), s.model_call_id],
          )
        ).rows[0],
    );
    return sug_row(row as Row);
  }

  async get(id: SuggestionId): Promise<SuggestionRow | null> {
    const r = await this.db.with_tx(async (tx) => (await tx.query<Row>(`SELECT * FROM suggestion WHERE id=$1`, [id])).rows[0]);
    if (!r) return null;
    const row = sug_row(r);
    // An expired pending suggestion reads as closed; nothing is written back.
    if (row.status === "pending" && row.expires_at.getTime() <= this.clock.now().getTime()) return { ...row, status: "closed" };
    return row;
  }

  async decide(id: SuggestionId, status: "accepted" | "rejected" | "closed", by: UserId, tx: Tx): Promise<SuggestionRow> {
    const t = real_tx(tx);
    const res = await t.query<Row>(
      `UPDATE suggestion SET status=$2, decided_by=$3, decided_at=$4::timestamptz
       WHERE id=$1 AND status='pending' AND (expires_at > $4::timestamptz OR $2 = 'closed') RETURNING *`,
      [id, status, by, this.clock.now().toISOString()],
    );
    if (res.rows[0]) return sug_row(res.rows[0]);
    const cur = await t.query<Row>(`SELECT status FROM suggestion WHERE id=$1`, [id]);
    if (!cur.rows[0]) throw new InvariantViolation("suggestion not found", { suggestion_id: id });
    throw new InvariantViolation("suggestion already decided or expired", { suggestion_id: id, status: cur.rows[0]["status"] });
  }

  async pending_for(lesson_id: LessonId, now: Date): Promise<SuggestionRow[]> {
    const rows = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query<Row>(`SELECT * FROM suggestion WHERE lesson_id=$1 AND status='pending' AND expires_at > $2::timestamptz ORDER BY expires_at, id`, [
            lesson_id, now.toISOString(),
          ])
        ).rows,
    );
    return rows.map(sug_row);
  }
}
