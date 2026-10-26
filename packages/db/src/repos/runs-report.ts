// Astra slice B: facts a run report needs, read from stored rows and pinned to the run's own generated lesson versions.
// SELECT only. A later edit, a later check or a later round trip never rewrites what a finished run produced.
import Decimal from "decimal.js";
import type { CheckKind, IssueLevelName, JobId, LessonId, RunId, Sha256, Usd, VersionId } from "@ls/core/ports/common";
import type { PgDatabase } from "../pool.ts";

export interface RunReportLesson {
  job_id: JobId;
  lesson_id: LessonId;
  version: { version_id: VersionId; number: number; content_hash: Sha256; schema_version: number } | null;
  slot_nodes: { quote_placeholder: number; excerpt_slot: number };
  check: { state: "checked" | "pending" | "no_version"; checked_at: Date | null };
  open_issues: { kind: CheckKind; level: IssueLevelName; count: number }[];
  unconfirmed_alignment: number;
  seed_doc_hash: Sha256 | null;
  calls_cost_usd: Usd;
}
export interface RunReportFacts {
  run_id: RunId;
  lessons: RunReportLesson[];
  checks_pending: number;
  checked_through: Date | null;
}

type Q = Pick<Awaited<Parameters<Parameters<PgDatabase["with_tx"]>[0]>[0]>, "query">;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg rows are untyped; every field is read explicitly
type Row = Record<string, any>;

/** Counts compiled slot nodes anywhere in a JSON value, including inside lists and table cells. A filled slot is a quote node and is not counted. */
export function count_slot_nodes(sections: unknown): { quote_placeholder: number; excerpt_slot: number } {
  const out = { quote_placeholder: 0, excerpt_slot: 0 };
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (v === null || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (o["type"] === "quote_placeholder") out.quote_placeholder += 1;
    else if (o["type"] === "excerpt_slot") out.excerpt_slot += 1;
    for (const x of Object.values(o)) walk(x);
  };
  walk(sections);
  return out;
}

const LESSON_JOBS = `SELECT id, lesson_id FROM lesson_job WHERE run_id = $1 AND kind = 'lesson' AND lesson_id IS NOT NULL ORDER BY queued_at, id`;
// The run's own first generated version of the lesson, never "the lesson's current version".
const PINNED_VERSION = `SELECT id, number, content_hash, lesson_json->'sections' AS sections,
        COALESCE((lesson_json->>'schema_version')::int, 1) AS schema_version
   FROM lesson_version WHERE run_id = $1 AND lesson_id = $2 AND kind = 'generated' ORDER BY number ASC LIMIT 1`;

/** Open slot nodes in the run's generated versions (the run summary's placeholders_left). */
export async function placeholders_left(tx: Q, run_id: RunId): Promise<number> {
  let total = 0;
  for (const j of (await tx.query(LESSON_JOBS, [run_id])).rows as Row[]) {
    const v = (await tx.query(PINNED_VERSION, [run_id, j["lesson_id"]])).rows[0] as Row | undefined;
    if (v === undefined) continue;
    const n = count_slot_nodes(v["sections"]);
    total += n.quote_placeholder + n.excerpt_slot;
  }
  return total;
}

export async function read_report_facts(db: PgDatabase, run_id: RunId): Promise<RunReportFacts> {
  return db.with_tx(async (tx) => {
    const lessons: RunReportLesson[] = [];
    for (const j of (await tx.query(LESSON_JOBS, [run_id])).rows as Row[]) {
      const lesson_id = j["lesson_id"] as LessonId;
      const job_id = j["id"] as JobId;
      const v = (await tx.query(PINNED_VERSION, [run_id, lesson_id])).rows[0] as Row | undefined;
      const cost = (await tx.query(`SELECT COALESCE(sum(cost_usd),0)::text AS c FROM model_call WHERE job_id = $1 AND status = 'completed'`, [job_id])).rows[0] as Row;
      const seed = (await tx.query(`SELECT content_hash FROM lesson_doc WHERE lesson_id = $1 ORDER BY seq ASC LIMIT 1`, [lesson_id])).rows[0] as Row | undefined;
      const base = {
        job_id, lesson_id, seed_doc_hash: (seed?.["content_hash"] ?? null) as Sha256 | null, calls_cost_usd: new Decimal(cost["c"]),
      };
      if (v === undefined) {
        lessons.push({
          ...base, version: null, slot_nodes: { quote_placeholder: 0, excerpt_slot: 0 },
          check: { state: "no_version", checked_at: null }, open_issues: [], unconfirmed_alignment: 0,
        });
        continue;
      }
      const hash = v["content_hash"] as string;
      const done = (await tx.query(
        `SELECT max(finished_at) AS at FROM check_job WHERE lesson_id = $1 AND content_hash = $2 AND status = 'done'`, [lesson_id, hash])).rows[0] as Row;
      const seen = (await tx.query(
        `SELECT count(*)::int AS n, max(created_at) AS at FROM issue WHERE lesson_id = $1 AND content_hash = $2`, [lesson_id, hash])).rows[0] as Row;
      const times = [done["at"], seen["at"]].filter((x): x is Date => x instanceof Date);
      const checked = times.length > 0 || seen["n"] > 0 || (await tx.query(
        `SELECT 1 FROM check_job WHERE lesson_id = $1 AND content_hash = $2 AND status = 'done' LIMIT 1`, [lesson_id, hash])).rows.length > 0;
      const checked_at = times.length === 0 ? null : new Date(Math.max(...times.map((t) => t.getTime())));
      const open = (await tx.query(
        `SELECT kind, level, count(*)::int AS count FROM issue
          WHERE lesson_id = $1 AND content_hash = $2 AND resolved_at IS NULL AND cleared_by IS NULL
          GROUP BY kind, level ORDER BY kind, level`, [lesson_id, hash])).rows as Row[];
      const align = (await tx.query(
        `SELECT count(*)::int AS n FROM alignment_link WHERE lesson_id = $1 AND content_hash = $2 AND origin <> 'outline' AND confirmed_by IS NULL`,
        [lesson_id, hash])).rows[0] as Row;
      lessons.push({
        ...base,
        version: { version_id: v["id"], number: v["number"], content_hash: hash as Sha256, schema_version: v["schema_version"] },
        slot_nodes: count_slot_nodes(v["sections"]),
        check: { state: checked ? "checked" : "pending", checked_at },
        open_issues: open.map((o) => ({ kind: o["kind"], level: o["level"], count: o["count"] })),
        unconfirmed_alignment: align["n"],
      });
    }
    const stamps = lessons.filter((l) => l.check.state === "checked" && l.check.checked_at !== null).map((l) => (l.check.checked_at as Date).getTime());
    return {
      run_id, lessons,
      checks_pending: lessons.filter((l) => l.check.state === "pending").length,
      checked_through: stamps.length === 0 ? null : new Date(Math.max(...stamps)),
    };
  });
}
