// NL-104: read side of CON-10 `quality` (tiles V-1..V-6, O-1..O-4, H-1..H-6, rating counts, seeded errors).
// Read-only SQL over stored rows; no model call, no write, and no person's name or id is ever selected (GR-15).
// Scale: percentages 0-100 and V-4 0-1 (two decimals); the screen prints values as received.
// V-4 is whole-lesson and capped at EDIT_TOKEN_CAP tokens per text (registry says per section; seam follow-up).
// H-4..H-6 read the latest global probe_run row (the table has no unit column); the seeded-error count is the newest
// finished S10 eval_run (global, labelled "our reviewers").
import type { UnitId } from "@ls/core/ports/common";
import type { PgDatabase } from "@ls/db/pool";
import type { UnitMetrics } from "@ls/schema/api/metrics";
import { normalized_edit_distance } from "./edit-distance.ts";

export type UnitQuality = NonNullable<UnitMetrics["quality"]>;
export interface UnitQualityProvider { read(unit_id: UnitId): Promise<UnitQuality> }

export const LOADED_RATE_USD_PER_HOUR = 40; // registry M-11 [A]
export const SEEDED_LABEL = "our reviewers";

export const TILE_LABELS: Readonly<Record<string, string>> = {
  "V-1": "First-pass clean rate",
  "V-2": "Standards claims confirmed",
  "V-3": "Quotes sourced or placeholder",
  "V-4": "Edit distance, draft to approved",
  "V-5": "Changes-requested rate",
  "V-6": "AI-assist accept rate",
  "O-1": "Cost per approved lesson",
  "O-2": "Approved lessons per reviewer-hour",
  "O-3": "Unit lead time",
  "O-4": "Standards assessed",
  "H-1": "Generation success rate",
  "H-2": "Generation time per lesson (p95)",
  "H-3": "Run spend against its cap (highest run)",
  "H-4": "Lesson open (p95, load probe, all units)",
  "H-5": "Remote edit visible (p95, load probe, all units)",
  "H-6": "Unit page load (p95, load probe, all units)",
};

/** Stored tables each tile is read from (AC-7). */
export const SOURCES: Readonly<Record<string, readonly string[]>> = {
  "V-1": ["lesson", "lesson_version", "issue"],
  "V-2": ["lesson", "lesson_metrics", "lesson_version", "alignment_link"],
  "V-3": ["lesson"],
  "V-4": ["lesson", "lesson_metrics", "lesson_version"],
  "V-5": ["lesson", "review_event"],
  "V-6": ["lesson", "suggestion"],
  "O-1": ["lesson", "lesson_metrics", "model_call"],
  "O-2": ["lesson", "lesson_metrics"],
  "O-3": ["lesson", "lesson_metrics", "outline_version"],
  "O-4": ["lesson", "lesson_metrics", "lesson_version", "alignment_link"],
  "H-1": ["run", "lesson_job"],
  "H-2": ["run", "lesson_job"],
  "H-3": ["run", "model_call"],
  "H-4": ["probe_run"],
  "H-5": ["probe_run"],
  "H-6": ["probe_run"],
};

type Tile = UnitQuality["tiles"][number];
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg rows are untyped; each reader names its columns
type Row = Record<string, any>;
type Q = (sql: string, params?: unknown[]) => Promise<Row[]>;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const tile = (id: string, value: number | null, n: number): Tile => {
  const empty = value === null || n === 0;
  return { id, value: empty ? null : value, n: empty ? 0 : n, label: TILE_LABELS[id]! };
};
const pct = (part: number, whole: number): number | null => (whole === 0 ? null : Math.round((part / whole) * 10000) / 100);
const round2 = (x: number): number => Math.round(x * 100) / 100;

const FM = `lesson_metrics m JOIN lesson l ON l.id = m.lesson_id WHERE l.unit_id = $1`;
const LINKS = `alignment_link a
  JOIN lesson_metrics m ON m.lesson_id = a.lesson_id
  JOIN lesson_version lv ON lv.id = m.version_id AND lv.content_hash = a.content_hash
  JOIN lesson l ON l.id = a.lesson_id
  WHERE l.unit_id = $1`;

async function build(q: Q, unit_id: string): Promise<UnitQuality> {
  const one = async (sql: string, params: unknown[] = [unit_id]): Promise<Row> => (await q(sql, params))[0] ?? {};
  const v1 = await one(
    `SELECT count(*)::int AS n,
            count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM issue i WHERE i.lesson_id = lv.lesson_id
              AND i.content_hash = lv.content_hash AND i.level = 'blocking'))::int AS clean
       FROM lesson_version lv JOIN lesson l ON l.id = lv.lesson_id
      WHERE l.unit_id = $1 AND lv.number = 1 AND lv.kind = 'generated'`,
  );
  const links = await one(
    `SELECT count(DISTINCT a.code)::int AS n,
            count(DISTINCT a.code) FILTER (WHERE a.confirmed_by IS NOT NULL)::int AS confirmed,
            count(DISTINCT a.code) FILTER (WHERE a.role = 'A')::int AS assessed
       FROM ${LINKS}`,
  );
  const pairs = await q(
    `SELECT g.lesson_json::text AS a, ap.lesson_json::text AS b
       FROM lesson_metrics m JOIN lesson l ON l.id = m.lesson_id
       JOIN lesson_version ap ON ap.id = m.version_id
       JOIN lesson_version g ON g.lesson_id = m.lesson_id AND g.number = 1 AND g.kind = 'generated'
      WHERE l.unit_id = $1`,
    [unit_id],
  );
  const dists = pairs.map((p) => normalized_edit_distance(String(p["a"]), String(p["b"]))).sort((x, y) => x - y);
  const mid = Math.floor(dists.length / 2);
  const v4 = dists.length === 0 ? null : round2(dists.length % 2 === 1 ? dists[mid]! : (dists[mid - 1]! + dists[mid]!) / 2);
  const v5 = await one(
    `WITH ev AS (SELECT e.lesson_id, e.to_state FROM review_event e JOIN lesson l ON l.id = e.lesson_id WHERE l.unit_id = $1)
     SELECT count(DISTINCT lesson_id) FILTER (WHERE to_state = 'submitted')::int AS submitted,
            count(DISTINCT lesson_id) FILTER (WHERE to_state = 'submitted'
              AND lesson_id IN (SELECT lesson_id FROM ev WHERE to_state = 'changes_requested'))::int AS sent_back
       FROM ev`,
  );
  const v6 = await one(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE s.status = 'accepted')::int AS accepted
       FROM suggestion s JOIN lesson l ON l.id = s.lesson_id WHERE l.unit_id = $1`,
  );
  const fm = await one(`SELECT count(*)::int AS n, coalesce(sum(m.active_minutes), 0) AS minutes,
            count(*) FILTER (WHERE m.human_sessions > 0)::int AS human_n,
            coalesce(sum(m.active_minutes) FILTER (WHERE m.human_sessions > 0), 0) AS human_minutes,
            max(m.approved_at) AS last_approved FROM ${FM}`);
  const cost = await one(
    `SELECT coalesce(sum(mc.cost_usd), 0) AS cost FROM model_call mc
      WHERE mc.lesson_id IN (SELECT m.lesson_id FROM ${FM})`,
  );
  const lead = await one(
    `SELECT confirmed_at FROM outline_version WHERE unit_id = $1 ORDER BY number DESC LIMIT 1`,
  );
  const jobs = await one(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE j.status = 'ready')::int AS ready,
            count(*) FILTER (WHERE j.started_at IS NOT NULL AND j.finished_at IS NOT NULL)::int AS timed,
            percentile_disc(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM (j.finished_at - j.started_at)) / 60)
              FILTER (WHERE j.started_at IS NOT NULL AND j.finished_at IS NOT NULL) AS p95_min
       FROM lesson_job j JOIN run r ON r.id = j.run_id WHERE r.unit_id = $1 AND j.kind = 'lesson'`,
  );
  const spend = await one(
    `SELECT count(*)::int AS n, max(x.s / r.cap_usd * 100) AS top
       FROM run r LEFT JOIN LATERAL (SELECT coalesce(sum(cost_usd), 0) AS s FROM model_call WHERE run_id = r.id) x ON true
      WHERE r.unit_id = $1 AND r.cap_usd > 0`,
  );
  const probe = async (kind: string, key: string): Promise<{ v: number | null; n: number }> => {
    const r = await one(`SELECT p95_json ->> '${key}' AS v, n FROM probe_run WHERE kind = $1 ORDER BY id DESC LIMIT 1`, [kind]);
    return { v: num(r["v"]), n: Number(r["n"] ?? 0) };
  };
  const h4 = await probe("http", "lesson_open");
  const h5 = await probe("yjs", "remote_edit");
  const h6 = await probe("http", "board");
  const ratings = await one(
    `SELECT count(*) FILTER (WHERE m.draft_rating = 1)::int AS a, count(*) FILTER (WHERE m.draft_rating = 2)::int AS b,
            count(*) FILTER (WHERE m.draft_rating = 3)::int AS c FROM ${FM}`,
  );
  const s10 = await one(
    `SELECT passed, total FROM eval_run WHERE suite = 'S10' AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1`,
    [],
  );

  const fmN = Number(fm["n"] ?? 0);
  const humanMinutes = Number(fm["human_minutes"] ?? 0);
  const o1 = fmN === 0 ? null : round2((Number(cost["cost"]) + (Number(fm["minutes"]) / 60) * LOADED_RATE_USD_PER_HOUR) / fmN);
  const o2 = humanMinutes === 0 ? null : round2(Number(fm["human_n"]) / (humanMinutes / 60));
  const confirmed = lead["confirmed_at"] as Date | null | undefined;
  const last = fm["last_approved"] as Date | null | undefined;
  const o3 = confirmed && last ? round2((last.getTime() - confirmed.getTime()) / 86_400_000) : null;
  const p95min = num(jobs["p95_min"]);

  const tiles: Tile[] = [
    tile("V-1", pct(Number(v1["clean"] ?? 0), Number(v1["n"] ?? 0)), Number(v1["n"] ?? 0)),
    tile("V-2", pct(Number(links["confirmed"] ?? 0), Number(links["n"] ?? 0)), Number(links["n"] ?? 0)),
    tile("V-3", null, 0),
    tile("V-4", v4, dists.length),
    tile("V-5", pct(Number(v5["sent_back"] ?? 0), Number(v5["submitted"] ?? 0)), Number(v5["submitted"] ?? 0)),
    tile("V-6", pct(Number(v6["accepted"] ?? 0), Number(v6["n"] ?? 0)), Number(v6["n"] ?? 0)),
    tile("O-1", o1, fmN),
    tile("O-2", o2, Number(fm["human_n"] ?? 0)),
    tile("O-3", o3, fmN),
    tile("O-4", pct(Number(links["assessed"] ?? 0), Number(links["n"] ?? 0)), Number(links["n"] ?? 0)),
    tile("H-1", pct(Number(jobs["ready"] ?? 0), Number(jobs["n"] ?? 0)), Number(jobs["n"] ?? 0)),
    tile("H-2", p95min === null ? null : round2(p95min), Number(jobs["timed"] ?? 0)),
    tile("H-3", num(spend["top"]) === null ? null : round2(Number(spend["top"])), Number(spend["n"] ?? 0)),
    tile("H-4", h4.v === null ? null : round2(h4.v / 1000), h4.n),
    tile("H-5", h5.v === null ? null : round2(h5.v), h5.n),
    tile("H-6", h6.v === null ? null : round2(h6.v / 1000), h6.n),
  ];
  const a = Number(ratings["a"] ?? 0);
  const b = Number(ratings["b"] ?? 0);
  const c = Number(ratings["c"] ?? 0);
  return {
    tiles,
    rating_counts: { usable_as_drafted: a, usable_with_edits: b, rewritten: c, n: a + b + c },
    seeded_errors: { planted: Number(s10["total"] ?? 0), caught: Number(s10["passed"] ?? 0), label: SEEDED_LABEL },
  };
}

export class PgUnitQualityReader implements UnitQualityProvider {
  constructor(private readonly db: PgDatabase) {} // must not touch db at construction

  read(unit_id: UnitId): Promise<UnitQuality> {
    return this.db.with_tx(async (tx) => {
      const q: Q = async (sql, params = []) => (await tx.query<Row>(sql, params)).rows;
      return build(q, unit_id);
    });
  }
}
