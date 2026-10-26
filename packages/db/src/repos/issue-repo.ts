import type { Clock } from "@ls/core/ports/clock";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { IssueId, LessonId, Sha256, UnitId } from "@ls/core/ports/common";
import type {
  CheckFinding, IssueRepo, IssueRow, IssueSet, LessonIssueCounts, NewResolution,
} from "@ls/core/ports/issues";
import type { Tx } from "@ls/core/ports/tx";
import { DomainRefusal, InvariantViolation } from "@ls/core/errors";
import { RULE_ENGINE_KINDS } from "@ls/core/checks/types";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";

// CON-13 interpretation (no checked_hash column; DDL belongs to NL-08): the newest checked hash of a lesson
// is the later of (a) its newest issue row and (b) its newest done check_job. A run with zero findings leaves
// no issue row, so the done job is what records it. Tie on the timestamp goes to the issue row.
// `lesson_expr` is a SQL expression for the lesson id (a $n placeholder or an outer column).
export const checked_hash_sql = (lesson_expr: string): string => `
  SELECT s.content_hash, s.at FROM (
    (SELECT i.content_hash, i.created_at AS at, 0 AS rank FROM issue i
       WHERE i.lesson_id = ${lesson_expr} ORDER BY i.created_at DESC, i.id DESC LIMIT 1)
    UNION ALL
    (SELECT j.content_hash, j.finished_at AS at, 1 AS rank FROM check_job j
       WHERE j.lesson_id = ${lesson_expr} AND j.status = 'done' AND j.finished_at IS NOT NULL
       ORDER BY j.finished_at DESC, j.id DESC LIMIT 1)
  ) s ORDER BY s.at DESC, s.rank LIMIT 1`;

export async function checked_hash_for(
  tx: DbTx,
  lesson_id: LessonId,
): Promise<{ content_hash: Sha256; at: Date } | null> {
  const r = await tx.query<{ content_hash: Sha256; at: Date }>(checked_hash_sql("$1"), [lesson_id]);
  return r.rows[0] ?? null;
}

const COLS = `id, lesson_id, content_hash, level, kind, message, address, span_anchor, related_lesson_id,
  code, resolved_by, resolution_reason, resolved_at, cleared_by, created_at`;

type Raw = Omit<IssueRow, "issue_id"> & { id: IssueId };
const to_row = ({ id, ...rest }: Raw): IssueRow => ({ issue_id: id, ...rest });

const NUL = "\u0001null";
const key = (r: { kind: string; address: string | null; code: string | null }): string =>
  `${r.kind}\u0000${r.address ?? NUL}\u0000${r.code ?? NUL}`;

function need_tx(tx: Tx, what: string): DbTx {
  if (!(tx instanceof DbTx)) throw new InvariantViolation(`${what} needs a real transaction`);
  return tx;
}

export class PgIssueRepo implements IssueRepo {
  readonly #db: PgDatabase;
  readonly #ids: IdGenerator;
  readonly #clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.#db = deps.db;
    this.#ids = deps.ids;
    this.#clock = deps.clock;
  }

  async replace_for_hash(
    lesson_id: LessonId,
    content_hash: Sha256,
    findings: readonly CheckFinding[],
    tx: Tx,
  ): Promise<IssueSet> {
    const q = need_tx(tx, "replace_for_hash");
    const now = this.#clock.now();
    const iso = now.toISOString();
    const existing = (await q.query<Raw>(`SELECT ${COLS} FROM issue WHERE lesson_id=$1`, [lesson_id])).rows;
    const same_hash = existing.some((r) => r.content_hash === content_hash);

    const fresh = new Set(findings.map(key));
    if (same_hash) {
      // Retry, a re-check at an unchanged hash (S-33), or an edit back to an earlier hash: re-affirm as newest,
      // clear open rows the re-check no longer produces (cleared_by='fix', never DELETE), add new findings.
      await q.query(
        `UPDATE issue SET created_at=$3::timestamptz,
           cleared_by = CASE WHEN cleared_by='fix' THEN NULL ELSE cleared_by END
         WHERE lesson_id=$1 AND content_hash=$2`,
        [lesson_id, content_hash, iso],
      );
      const here = existing.filter((r) => r.content_hash === content_hash);
      const gone = here.filter((r) => r.resolved_at === null && RULE_ENGINE_KINDS.includes(r.kind) && !fresh.has(key(r))).map((r) => r.id);
      if (gone.length > 0) await q.query(`UPDATE issue SET cleared_by='fix' WHERE id = ANY($1)`, [gone]);
      const have = new Set(here.map(key));
      await this.#insert_findings(q, lesson_id, content_hash, findings.filter((f) => !have.has(key(f))), existing, iso);
    } else {
      await this.#insert_findings(q, lesson_id, content_hash, findings, existing, iso);
    }

    // Fix-clearing: open rows of other hashes whose key is gone from the new findings.
    const stale = existing
      .filter((r) => r.content_hash !== content_hash && r.resolved_at === null && r.cleared_by === null)
      .filter((r) => !fresh.has(key(r)))
      .map((r) => r.id);
    if (stale.length > 0) await q.query(`UPDATE issue SET cleared_by='fix' WHERE id = ANY($1)`, [stale]);

    const rows = (
      await q.query<Raw>(
        `SELECT ${COLS} FROM issue WHERE lesson_id=$1 AND content_hash=$2 AND cleared_by IS DISTINCT FROM 'fix' ORDER BY created_at, id`,
        [lesson_id, content_hash],
      )
    ).rows;
    return { lesson_id, checked_hash: content_hash, checked_at: now, issues: rows.map(to_row) };
  }

  async #insert_findings(
    q: DbTx,
    lesson_id: LessonId,
    content_hash: Sha256,
    findings: readonly CheckFinding[],
    existing: readonly Raw[],
    iso: string,
  ): Promise<void> {
    const latest = new Map<string, Raw>();
    const resolved = existing
      .filter((r) => r.resolved_at !== null)
      .sort((a, b) => a.resolved_at!.getTime() - b.resolved_at!.getTime() || (a.id < b.id ? -1 : 1));
    for (const r of resolved) latest.set(key(r), r);
    for (const f of findings) {
      const carried = latest.get(key(f));
      await q.query(
        `INSERT INTO issue (id, lesson_id, content_hash, level, kind, message, address, span_anchor,
           related_lesson_id, code, resolved_by, resolution_reason, resolved_at, cleared_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz,$14,$15::timestamptz)`,
        [
          this.#ids.new_id("iss"), lesson_id, content_hash, f.level, f.kind, f.message, f.address,
          f.span_anchor, f.related_lesson_id, f.code,
          carried?.resolved_by ?? null, carried?.resolution_reason ?? null,
          carried?.resolved_at ? carried.resolved_at.toISOString() : null,
          carried ? "resolution" : null, iso,
        ],
      );
    }
  }

  async current(lesson_id: LessonId): Promise<IssueSet> {
    return this.#db.with_tx(async (tx) => {
      const ch = await checked_hash_for(tx, lesson_id);
      if (!ch) return { lesson_id, checked_hash: null, checked_at: null, issues: [] };
      const rows = (
        await tx.query<Raw>(
          `SELECT ${COLS} FROM issue WHERE lesson_id=$1 AND content_hash=$2 AND cleared_by IS DISTINCT FROM 'fix' ORDER BY created_at, id`,
          [lesson_id, ch.content_hash],
        )
      ).rows;
      return { lesson_id, checked_hash: ch.content_hash, checked_at: ch.at, issues: rows.map(to_row) };
    });
  }

  async get(issue_id: IssueId): Promise<IssueRow | null> {
    const r = await this.#db.with_tx((tx) => tx.query<Raw>(`SELECT ${COLS} FROM issue WHERE id=$1`, [issue_id]));
    return r.rows[0] ? to_row(r.rows[0]) : null;
  }

  async resolve(r: NewResolution, tx: Tx): Promise<IssueRow> {
    const q = need_tx(tx, "resolve");
    const found = (await q.query<Raw>(`SELECT ${COLS} FROM issue WHERE id=$1 FOR UPDATE`, [r.issue_id])).rows[0];
    if (!found) throw new DomainRefusal("NOT_FOUND", "no such issue", { issue_id: r.issue_id });
    if (found.resolved_at !== null) return to_row(found);
    // r.request_id is not stored here: the issue table has no such column; audit is the service's job.
    const upd = await q.query<Raw>(
      `UPDATE issue SET resolved_by=$2, resolution_reason=$3, resolved_at=$4::timestamptz, cleared_by='resolution'
       WHERE id=$1 RETURNING ${COLS}`,
      [r.issue_id, r.by, r.reason, this.#clock.now().toISOString()],
    );
    return to_row(upd.rows[0]!);
  }

  async resolutions_for(lesson_id: LessonId): Promise<IssueRow[]> {
    const r = await this.#db.with_tx((tx) =>
      tx.query<Raw>(
        `SELECT DISTINCT ON (kind, address, code) ${COLS} FROM issue
         WHERE lesson_id=$1 AND resolved_at IS NOT NULL
         ORDER BY kind, address, code, resolved_at DESC, id DESC`,
        [lesson_id],
      ),
    );
    return r.rows.map(to_row);
  }

  async counts_by_lesson(unit_id: UnitId): Promise<LessonIssueCounts[]> {
    const r = await this.#db.with_tx((tx) =>
      tx.query<{ lesson_id: LessonId; blocking: number; confirmation: number; advisory: number }>(
        `SELECT l.id AS lesson_id,
           count(i.id) FILTER (WHERE i.level='blocking' AND i.resolved_at IS NULL)::int AS blocking,
           count(i.id) FILTER (WHERE i.level='confirmation' AND i.resolved_at IS NULL)::int AS confirmation,
           count(i.id) FILTER (WHERE i.level='advisory' AND i.resolved_at IS NULL)::int AS advisory
         FROM lesson l
         LEFT JOIN LATERAL (${checked_hash_sql("l.id")}) ch ON true
         LEFT JOIN issue i ON i.lesson_id = l.id AND i.content_hash = ch.content_hash
           AND i.cleared_by IS DISTINCT FROM 'fix'
         WHERE l.unit_id=$1
         GROUP BY l.id, l.number
         ORDER BY l.number NULLS LAST, l.id`,
        [unit_id],
      ),
    );
    return r.rows;
  }
}
