// NL-107 AC-10: the obligations WF-28 inherits, each checked against the rows and logs a real claim-loop run over Postgres wrote
// (two lessons through the real wiring; the four-scenario run is s6-run.test.ts and s6-scenarios.int.test.ts).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { correlation } from "./s6-assertions.ts";
import { main, WF } from "./s6-run.ts";
import { CANARY } from "./s6-scenarios.ts";
import { make_healthy } from "./s6-drafts.ts";
import { make_world, plan_for, type World } from "./s6-world.ts";

let w: World;
let run_id = "";
const REPO = new URL("../../../", import.meta.url);

beforeAll(async () => {
  w = await make_world();
  w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
  const healthy = make_healthy(w.rows);
  w.stub.script("GENERATION", "lesson_draft", healthy);
  w.stub.script("REPAIR", "lesson_draft", healthy);
  run_id = await w.start_run(w.generatable.slice(0, 2).map((r) => r.row_number));
  expect(await w.drive_until(() => w.run_finished(run_id), 90_000)).toBe(true);
}, 150_000);
afterAll(async () => { await w?.close(); });

describe("WF-28 obligations", () => {
  it("R-48: one correlation id on the run, every lesson_job and every model_call of the run", async () => {
    const corr = await correlation(w, run_id);
    expect(corr.jobs).toBe(3); // unit plan + 2 lessons
    expect(corr.calls).toBeGreaterThanOrEqual(3);
    expect(corr.call_run_mismatches).toBe(0);
    expect((await w.query("select 1 from run where id=$1", [run_id])).length).toBe(1);
    expect((await w.query("select 1 from lesson_job where run_id<>$1", [run_id]))).toEqual([]);
  });

  it("GR-9: no restricted-folder path or text in any rendered prompt, raw output or worker log line", async () => {
    const rows = await w.query<{ t: string }>("select rendered_prompt || coalesce(raw_output,'') t from model_call where run_id=$1", [run_id]);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.t).not.toMatch(/restricted/i);
    for (const l of w.lines) expect(l).not.toMatch(/restricted/i);
    expect(readFileSync(new URL("evals/src/suites/s6-drafts.ts", REPO), "utf8")).not.toMatch(/docs\/source\/restricted/);
  });

  it("GR-13: seeded users are synthetic and no student or teacher-of-record column exists", async () => {
    const users = await w.query<{ synthetic: boolean }>("select synthetic from app_user");
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => u.synthetic)).toBe(true);
    const cols = await w.query<{ column_name: string }>("select column_name from information_schema.columns where table_schema='public' and column_name ~* '(student|pupil|teacher_of_record|date_of_birth|dob|guardian)'");
    expect(cols).toEqual([]);
  });

  it("OBS-7: a provider key in the environment reaches no row and no log line", async () => {
    const hits = await w.query<{ n: string }>(
      `select (select count(*) from model_call where rendered_prompt like $1 or raw_output like $1 or stop_reason like $1)
            + (select count(*) from lesson_job where failure_reasons_json::text like $1) n`, [`%${CANARY}%`]);
    expect(Number(hits[0]!.n)).toBe(0);
    for (const l of w.lines) expect(l).not.toContain(CANARY);
  });

  it("OBS-11: WF-28 is registered in observability.md and the script announces wf=WF-28 and refuses a real provider", async () => {
    const doc = readFileSync(new URL("docs/design/observability.md", REPO), "utf8");
    expect(doc).toMatch(/\| WF-28 \| HP-7 fault-injection script \(S6\), `npm run eval:faults`/);
    expect(WF).toBe("WF-28");
    expect(readFileSync(new URL("evals/src/suites/s6-run.ts", REPO), "utf8")).toContain("`wf=${WF} script=run-faults");
    expect(await main(["--provider", "real"], { out: () => undefined, err: () => undefined, env: {} })).toBe(2);
  });
});
