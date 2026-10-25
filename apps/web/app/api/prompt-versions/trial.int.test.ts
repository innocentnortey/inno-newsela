// @vitest-environment node
// NL-88 AC-7: save v(n+1), run a trial pinned to it, and the lesson is never overwritten.
import { afterEach, describe, expect, it } from "vitest";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import { PromptService } from "@/server/services/prompt-service.ts";
// NL-88 AC-7 drives the real worker on the stub; test-only cross-app import.
import { lesson_of, load_fixture, make_world, plan_for, text, type World } from "../../../../worker/test/support/world.ts";

const L4 = "G6.U4.L4";
const wp1 = load_fixture("wp-1.json");
const worlds: World[] = [];
afterEach(async () => {
  for (const w of worlds.splice(0)) await w.close();
});

const ready = (w: World, run_id: string) => async (): Promise<boolean> =>
  (await w.query("select 1 from lesson_job where run_id=$1 and lesson_id=$2 and status='ready'", [run_id, L4])).length > 0;

describe("trial run (NL-88 AC-7)", () => {
  it("trial_makes_candidate_not_overwrite", async () => {
    const w = await make_world();
    worlds.push(w);
    w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
    w.stub.script("GENERATION", "lesson_draft", (req) => (lesson_of(req) === L4 ? text(wp1.first_draft) : { kind: "text", text: "{}" }));
    w.stub.script("REPAIR", "lesson_draft", () => text(wp1.draft));

    const run1 = await w.start_run([8]);
    expect(await w.drive_until(ready(w, run1), 60_000)).toBe(true);
    const snap = async () => {
      const [l] = await w.query<{ cur: string; state: string }>("select current_version_id as cur, state from lesson where id=$1", [L4]);
      const [v] = await w.query<{ h: string }>("select content_hash as h from lesson_version where id=$1", [l!.cur]);
      const [d] = await w.query<{ h: string }>("select content_hash as h from lesson_doc where lesson_id=$1 order by seq desc limit 1", [L4]);
      const [n] = await w.query<{ n: number }>("select count(*)::int as n from lesson_version where lesson_id=$1", [L4]);
      return { cur: l!.cur, state: l!.state, hash: v!.h, doc_hash: d!.h, versions: n!.n };
    };
    const before = await snap();

    const base = { db: w.db, ids: w.deps.ids, clock: w.deps.clock };
    const repo = new PgPromptRepo(base);
    const svc = new PromptService(repo, new PgAuditLog(base), w.db, repo);
    const v2 = await svc.save_guidance(w.user(), {
      base_version_id: w.prompt_version_id,
      guidance_text: "TRIAL-GUIDANCE-MARKER-0003 prefer short sentences",
      reason: "trial",
    });

    const trial = await w.service.start(
      w.user(),
      { outline_version_id: w.outline_version_id, mode: "trial", lesson_id: L4, scope: { kind: "rows", rows: [8] }, prompt_version_id: v2.version_id, cap_usd: 13 } as never,
      null,
    );
    const jobs = await w.query<{ kind: string; status: string }>("select kind, status from lesson_job where run_id=$1", [trial.run_id]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.kind).toBe("candidate");
    expect((await w.query("select prompt_version_id, kind from run where id=$1", [trial.run_id]))[0]).toEqual({ prompt_version_id: v2.version_id, kind: "trial" });
    expect((await w.query<{ prompt_version_id: string }>("select prompt_version_id from run where id=$1", [run1]))[0]!.prompt_version_id).toBe(w.prompt_version_id);

    const done = await w.drive_until(ready(w, trial.run_id), 60_000);
    if (!done) {
      console.error(await w.query("select * from lesson_job where run_id=$1", [trial.run_id]), w.lines.slice(-20));
    }
    expect(done).toBe(true);

    const after = await snap();
    expect(after.cur).toBe(before.cur);
    expect(after.hash).toBe(before.hash);
    expect(after.doc_hash).toBe(before.doc_hash);
    expect(after.state).toBe(before.state);
    expect(after.versions).toBe(before.versions + 1);
    const [cand] = await w.query<{ kind: string; adopted: boolean }>("select kind, adopted from lesson_version where lesson_id=$1 and run_id=$2", [L4, trial.run_id]);
    expect(cand).toEqual({ kind: "candidate", adopted: false });
    const calls = await w.query<{ rendered_prompt: string }>("select rendered_prompt from model_call where run_id=$1", [trial.run_id]);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.rendered_prompt).toContain("TRIAL-GUIDANCE-MARKER-0003");
      expect(c.rendered_prompt.indexOf("### locked")).toBeLessThan(c.rendered_prompt.indexOf("### guidance"));
    }
    console.info("trial evidence", { before, after, candidate: cand });
  }, 90_000);
});
