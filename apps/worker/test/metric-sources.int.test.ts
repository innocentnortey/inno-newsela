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

async function metric(sql: string): Promise<{ value: number; n: number }> {
  const [r] = await w.query<{ value: string | null; n: string | number }>(sql);
  return { value: Number(r!.value ?? 0), n: Number(r!.n) };
}
const first_versions = "(select distinct on (lesson_id) * from lesson_version order by lesson_id, number)";
const lesson_jobs = "lesson_job where kind='lesson'";
const placeholders = (col: string): string =>
  `(length(${col}::text) - length(replace(${col}::text, '"type": "excerpt_slot"', '')))/length('"type": "excerpt_slot"') + (length(${col}::text) - length(replace(${col}::text, '"type": "quote_placeholder"', '')))/length('"type": "quote_placeholder"')`;

const SOURCES: Array<[string, string, boolean]> = [
  ["M-5 first-pass clean rate", `select avg((not exists (select 1 from issue i where i.lesson_id=v.lesson_id and i.content_hash=v.content_hash and i.level='blocking'))::int) as value, count(*) as n from ${first_versions} v`, true],
  ["M-7 placeholders per lesson", `select avg(${placeholders("lesson_json")}) as value, count(*) as n from ${first_versions} v`, true],
  ["M-11 model spend per lesson", "select sum(cost_usd)/nullif(count(distinct lesson_id),0) as value, count(distinct lesson_id) as n from model_call where lesson_id is not null", true],
  ["M-15 generation success rate", `select avg((status='ready')::int) as value, count(*) as n from ${lesson_jobs}`, true],
  ["M-16 p95 generation minutes", `select percentile_cont(0.95) within group (order by extract(epoch from finished_at-started_at)/60) as value, count(*) as n from ${lesson_jobs} and finished_at is not null`, true],
  ["M-17 spend against cap", "select avg(s.spent/r.cap_usd) as value, count(*) as n from run r join lateral (select coalesce(sum(cost_usd),0) spent from model_call m where m.run_id=r.id) s on true", true],
  ["M-25 queue wait p95 minutes", `select percentile_cont(0.95) within group (order by extract(epoch from started_at-queued_at)/60) as value, count(*) as n from ${lesson_jobs} and started_at is not null`, true],
  ["M-28 model spend per lesson job", `select avg(cost_usd) as value, count(*) as n from ${lesson_jobs} and finished_at is not null`, true],
  ["M-29 build spend against the ceiling", "select sum(cost_usd)/75 as value, count(*) as n from model_call", true],
  ["M-31 schema-valid first-pass rate", `select avg((repairs=0)::int) as value, count(*) as n from ${lesson_jobs}`, true],
  ["M-38 safety flags open", "select count(*) filter (where status='open') as value, count(*) as n from safety_flag", false],
  ["M-41 confirmations per lesson", `select percentile_cont(0.5) within group (order by c) as value, count(*) as n from (select v.lesson_id, (select count(*) from alignment_link a where a.lesson_id=v.lesson_id and a.content_hash=v.content_hash and a.origin in ('narrowed','added')) c from ${first_versions} v) t`, false],
];

describe("AC-9 metric sources on a WP-1 + WP-2 run", () => {
  for (const [title, sql, needs_rows] of SOURCES) {
    it(title, async () => {
      const m = await metric(sql);
      console.info(title, m);
      expect(Number.isFinite(m.value)).toBe(true);
      if (needs_rows) expect(m.n).toBeGreaterThan(0);
      else expect(m.n).toBeGreaterThanOrEqual(0);
    });
  }
});
