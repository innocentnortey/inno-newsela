// NL-104 oracle: expected CON-10 quality block, computed from the stored rows with its own SQL (written from the tile table
// in the plan, section 3.4). Imports nothing from src/server. The arithmetic and rounding are done here in TypeScript.
import { db } from "../support/db";

export interface ExpectedTile { id: string; value: number | null; n: number }
export interface Expected {
  tiles: ExpectedTile[];
  rating_counts: { usable_as_drafted: number; usable_with_edits: number; rewritten: number; n: number };
  seeded_errors: { planted: number; caught: number; label: string };
}

export const round2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;

/** Token Levenshtein over whitespace tokens, first 600 of each, divided by the longer count. Independent of the product code. */
export function levenshtein_tokens(a: string, b: string): number {
  const t = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 600);
  const x = t(a), y = t(b);
  const longest = Math.max(x.length, y.length);
  if (longest === 0) return 0;
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) => [i, ...new Array<number>(y.length).fill(0)]);
  for (let j = 0; j <= y.length; j++) d[0]![j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
  }
  return d[x.length]![y.length]! / longest;
}

const one = async (sql: string, p: unknown[]): Promise<Record<string, any>> => (await db().query<Record<string, any>>(sql, p))[0] ?? {}; // eslint-disable-line @typescript-eslint/no-explicit-any
const pct = (a: number, b: number): number | null => (b === 0 ? null : round2((a * 100) / b));
const t = (id: string, value: number | null, n: number): ExpectedTile => (value === null || n === 0 ? { id, value: null, n: 0 } : { id, value, n });

export async function expectedQuality(unit_id: string): Promise<Expected> {
  const U = [unit_id];
  // V-1: lessons whose first generated version has no blocking issue on its hash
  const lessonsWithV1 = await db().query<{ lesson_id: string; hash: string }>(
    `select lv.lesson_id, lv.content_hash as hash from lesson_version lv where lv.number = 1 and lv.kind = 'generated'
       and lv.lesson_id in (select id from lesson where unit_id = $1)`, U);
  let clean = 0;
  for (const r of lessonsWithV1) {
    const b = await one("select count(*)::int as c from issue where lesson_id=$1 and content_hash=$2 and level='blocking'", [r.lesson_id, r.hash]);
    if (b["c"] === 0) clean++;
  }
  // V-2 / O-4: distinct codes over links that sit on an approved (frozen) version hash
  const links = await db().query<{ code: string; role: string; confirmed_by: string | null }>(
    `select a.code, a.role, a.confirmed_by from alignment_link a
       where exists (select 1 from lesson_metrics m join lesson_version v on v.id = m.version_id
                      where m.lesson_id = a.lesson_id and v.content_hash = a.content_hash)
         and a.lesson_id in (select id from lesson where unit_id = $1)`, U);
  const codes = new Set(links.map((l) => l.code));
  const confirmed = new Set(links.filter((l) => l.confirmed_by !== null).map((l) => l.code));
  const assessed = new Set(links.filter((l) => l.role === "A").map((l) => l.code));
  // V-4: median normalised token distance, first generated vs approved text
  const pairs = await db().query<{ a: string; b: string }>(
    `select (select lesson_json::text from lesson_version g where g.lesson_id = m.lesson_id and g.number = 1 and g.kind = 'generated') as a,
            (select lesson_json::text from lesson_version v where v.id = m.version_id) as b
       from lesson_metrics m where m.lesson_id in (select id from lesson where unit_id = $1)`, U);
  const dist = pairs.map((p) => levenshtein_tokens(p.a, p.b)).sort((x, y) => x - y);
  const mid = Math.floor(dist.length / 2);
  const v4 = dist.length === 0 ? null : round2(dist.length % 2 ? dist[mid]! : (dist[mid - 1]! + dist[mid]!) / 2);
  // V-5
  const ev = await db().query<{ lesson_id: string; to_state: string }>(
    "select lesson_id, to_state from review_event where lesson_id in (select id from lesson where unit_id = $1)", U);
  const submitted = new Set(ev.filter((e) => e.to_state === "submitted").map((e) => e.lesson_id));
  const back = new Set(ev.filter((e) => e.to_state === "changes_requested").map((e) => e.lesson_id));
  const sentBack = [...submitted].filter((l) => back.has(l)).length;
  // V-6
  const sg = await db().query<{ status: string }>("select status from suggestion where lesson_id in (select id from lesson where unit_id = $1)", U);
  // O-1..O-3 over the frozen rows
  const fm = await db().query<{ lesson_id: string; active_minutes: string; human_sessions: number; approved_at: Date }>(
    "select lesson_id, active_minutes, human_sessions, approved_at from lesson_metrics where lesson_id in (select id from lesson where unit_id = $1)", U);
  const minutes = fm.reduce((s, r) => s + Number(r.active_minutes), 0);
  const human = fm.filter((r) => r.human_sessions > 0);
  const humanMinutes = human.reduce((s, r) => s + Number(r.active_minutes), 0);
  const costRow = await one("select coalesce(sum(cost_usd),0) as c from model_call where lesson_id = any($1::text[])", [fm.map((r) => r.lesson_id)]);
  const o1 = fm.length === 0 ? null : round2((Number(costRow["c"]) + (minutes / 60) * 40) / fm.length);
  const o2 = humanMinutes === 0 ? null : round2(human.length / (humanMinutes / 60));
  const ov = await one("select confirmed_at from outline_version where unit_id=$1 order by number desc limit 1", U);
  const lastApproved = fm.length === 0 ? null : new Date(Math.max(...fm.map((r) => r.approved_at.getTime())));
  const o3 = ov["confirmed_at"] && lastApproved ? round2((lastApproved.getTime() - (ov["confirmed_at"] as Date).getTime()) / 86_400_000) : null;
  // H-1, H-2: jobs of the unit's runs
  const jobs = await db().query<{ status: string; mins: string | null }>(
    `select j.status, extract(epoch from (j.finished_at - j.started_at)) / 60 as mins
       from lesson_job j where j.kind = 'lesson' and j.run_id in (select id from run where unit_id = $1)`, U);
  const timed = jobs.filter((j) => j.mins !== null).map((j) => Number(j.mins)).sort((x, y) => x - y);
  const h2 = timed.length === 0 ? null : round2(timed[Math.ceil(0.95 * timed.length) - 1]!);
  // H-3
  const runs = await db().query<{ cap: string; spent: string }>(
    `select r.cap_usd as cap, coalesce((select sum(cost_usd) from model_call mc where mc.run_id = r.id), 0) as spent
       from run r where r.unit_id = $1 and r.cap_usd > 0`, U);
  const h3 = runs.length === 0 ? null : round2(Math.max(...runs.map((r) => (Number(r.spent) / Number(r.cap)) * 100)));
  // H-4..H-6: newest probe_run of each kind (ids sort by time)
  const probe = async (kind: string, key: string, div: number): Promise<{ v: number | null; n: number }> => {
    const r = await one("select p95_json, n from probe_run where kind = $1 order by id desc limit 1", [kind]);
    const raw = r["p95_json"]?.[key];
    return { v: raw === undefined || raw === null ? null : round2(Number(raw) / div), n: Number(r["n"] ?? 0) };
  };
  const h4 = await probe("http", "lesson_open", 1000), h5 = await probe("yjs", "remote_edit", 1), h6 = await probe("http", "board", 1000);
  const rat = await db().query<{ r: number | null }>("select draft_rating as r from lesson_metrics where lesson_id = any($1::text[])", [fm.map((x) => x.lesson_id)]);
  const cnt = (k: number) => rat.filter((x) => x.r === k).length;
  const s10 = await one("select passed, total from eval_run where suite='S10' and finished_at is not null order by id desc limit 1", []);

  return {
    tiles: [
      t("V-1", pct(clean, lessonsWithV1.length), lessonsWithV1.length),
      t("V-2", pct(confirmed.size, codes.size), codes.size),
      t("V-3", null, 0),
      t("V-4", v4, dist.length),
      t("V-5", pct(sentBack, submitted.size), submitted.size),
      t("V-6", pct(sg.filter((s) => s.status === "accepted").length, sg.length), sg.length),
      t("O-1", o1, fm.length),
      t("O-2", o2, human.length),
      t("O-3", o3, fm.length),
      t("O-4", pct(assessed.size, codes.size), codes.size),
      t("H-1", pct(jobs.filter((j) => j.status === "ready").length, jobs.length), jobs.length),
      t("H-2", h2, timed.length),
      t("H-3", h3, runs.length),
      t("H-4", h4.v, h4.n),
      t("H-5", h5.v, h5.n),
      t("H-6", h6.v, h6.n),
    ],
    rating_counts: { usable_as_drafted: cnt(1), usable_with_edits: cnt(2), rewritten: cnt(3), n: cnt(1) + cnt(2) + cnt(3) },
    seeded_errors: { planted: Number(s10["total"] ?? 0), caught: Number(s10["passed"] ?? 0), label: "our reviewers" },
  };
}
