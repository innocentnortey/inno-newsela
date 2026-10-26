// NL-79 AC-9: each listed metric has a working SQL source over rows a real claim-loop run wrote. Row ids are from
// docs/design/metrics-registry.md. Every query returns { value, n }; n counts the rows the value is computed from.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lesson_of, load_fixture, make_world, plan_for, text, World } from "./support/world.ts";

let w: World;
beforeAll(async () => {
  w = await make_world();
  const wp1 = load_fixture("wp-1.json");
  const wp2 = load_fixture("wp-2.json");
  w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
  w.stub.script("GENERATION", "lesson_draft", (req) => text(lesson_of(req) === "G6.U4.L4" ? wp1.first_draft : wp2.draft));
  w.stub.script("REPAIR", "lesson_draft", () => text(wp1.draft));
  const wp1_run = await w.start_run([8]);
  const wp2_run = await w.start_run([9]);
  const done = async (): Promise<boolean> => (await w.run_finished(wp1_run)) && (await w.run_finished(wp2_run));
  expect(await w.drive_until(done, 90_000)).toBe(true);
  expect((await w.run_checks_for()).length).toBe(2);
}, 120_000);
afterAll(async () => {
  await w?.close();
});

async function metric(sql: string): Promise<{ value: number | null; n: number }> {
  const [r] = await w.query<{ value: string | null; n: string | number }>(sql);
  return { value: r!.value === null ? null : Number(r!.value), n: Number(r!.n) };
}
const first_versions = "(select distinct on (lesson_id) * from lesson_version order by lesson_id, number)";
const lesson_jobs = "lesson_job where kind='lesson'";
const placeholders = (col: string): string =>
  `(length(${col}::text) - length(replace(${col}::text, '"type": "excerpt_slot"', '')))/length('"type": "excerpt_slot"') + (length(${col}::text) - length(replace(${col}::text, '"type": "quote_placeholder"', '')))/length('"type": "quote_placeholder"')`;

const SOURCES: Array<[string, string]> = [
  ["M-5 first-pass clean rate", `select avg((not exists (select 1 from issue i where i.lesson_id=v.lesson_id and i.content_hash=v.content_hash and i.level='blocking'))::int) as value, count(*) as n from ${first_versions} v`],
  ["M-7 placeholders per lesson", `select avg(${placeholders("lesson_json")}) as value, count(*) as n from ${first_versions} v`],
  ["M-11 model spend per lesson", "select sum(cost_usd)/nullif(count(distinct lesson_id),0) as value, count(distinct lesson_id) as n from model_call where lesson_id is not null"],
  ["M-15 generation success rate", `select avg((status='ready')::int) as value, count(*) as n from ${lesson_jobs}`],
  ["M-16 p95 generation minutes", `select percentile_cont(0.95) within group (order by extract(epoch from finished_at-started_at)/60) as value, count(*) as n from ${lesson_jobs} and finished_at is not null`],
  ["M-17 spend against cap", "select avg(s.spent/r.cap_usd) as value, count(*) as n from run r join lateral (select coalesce(sum(cost_usd),0) spent from model_call m where m.run_id=r.id) s on true"],
  ["M-25 queue wait p95 minutes", `select percentile_cont(0.95) within group (order by extract(epoch from started_at-queued_at)/60) as value, count(*) as n from ${lesson_jobs} and started_at is not null`],
  ["M-28 model spend per lesson job", `select avg(cost_usd) as value, count(*) as n from ${lesson_jobs} and finished_at is not null`],
  ["M-29 build spend against the ceiling", "select sum(cost_usd)/75 as value, count(*) as n from model_call"],
  ["M-31 schema-valid first-pass rate", `select avg((repairs=0)::int) as value, count(*) as n from ${lesson_jobs}`],
  ["M-38 safety flags open", "select count(*) filter (where status='open') as value, count(*) as n from safety_flag"],
  ["M-41 confirmations per lesson", `select percentile_cont(0.5) within group (order by c) as value, count(*) as n from (select v.lesson_id, (select count(distinct a.code) from alignment_link a where a.lesson_id=v.lesson_id and a.content_hash=v.content_hash and a.origin in ('narrowed','added')) c from ${first_versions} v) t`],
];

// Exact values the WP-1 (first draft invalid, one repair) + WP-2 (valid first pass) stub run implies; null = only "a number, n > 0".
const EXPECTED: Record<string, number> = {
  "M-5": 0, // both first versions carry a blocking issue on the stub run (WP-1 invalid first draft; WP-2 open slots)
  "M-7": 1.5,
  "M-15": 1, // both lesson jobs end ready
  "M-31": 0.5, // WP-1 needed one repair, WP-2 none
  // WP-2 (docs/data/worked-pairs.md, "Leaves of W.6.2 asserted by the generator (narrowed): blocking confirmation") allows narrowed
  // leaves with a confirmation. The stub WP-2 draft tags W.6.2.a and W.6.2.b, so L5 carries 2 confirmations (a reviewer confirms a CODE,
  // not each place it is linked; W.6.2.b is linked at Part A and Part B) and L4 (no narrowing) 0: median of [0, 2] = 1. The previous 0
  // predated the narrowed-leaf tags (WP-2 stub draft); 1.5 would have double-counted W.6.2.b's second link.
  "M-41": 1,
};
// M-38 reads safety_flag: only the WP-4 script writes one, and this run has no WP-4 lesson, so n = 0 is legitimate here.
const LEGITIMATELY_EMPTY = new Set(["M-38"]);

describe("AC-9 metric sources on a WP-1 + WP-2 run", () => {
  for (const [title, sql] of SOURCES) {
    const id = title.split(" ")[0]!;
    it(title, async () => {
      const m = await metric(sql);
      expect(m.value).not.toBeNull(); // a NULL here means the source is not computable
      expect(Number.isFinite(m.value)).toBe(true);
      if (LEGITIMATELY_EMPTY.has(id)) {
        expect(m.n).toBe(0);
        expect(m.value).toBe(0);
      } else {
        expect(m.n).toBeGreaterThan(0);
      }
      if (id in EXPECTED) expect(m.value).toBeCloseTo(EXPECTED[id]!, 6);
      if (id === "M-15" || id === "M-31") expect(m.n).toBe(2);
    });
  }
});
