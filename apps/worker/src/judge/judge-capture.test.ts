// NL-110 integration: the judge claim loop on the real test Postgres (scripts/test-db.sh up), stub judge, real repos.
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SecretStr } from "@ls/config/secret";
import { teaching_parts } from "@ls/core/checks/rules/alignment/standards-view";
import { visit_with_parts } from "@ls/core/checks/rules/structural/doc-walk";
import { ProviderError } from "@ls/core/errors";
import type { JudgeClient, JudgeRequest } from "@ls/core/ports/judge-client";
import { insert_row } from "@ls/db/testing/insert-row";
import { wp1 } from "@ls/db/repos/lesson-docs.test-support";
import { OpenRouterJudgeAdapter } from "@ls/llm/openrouter-judge";
import { StubJudgeClient } from "@ls/llm/stub";
import type { StoredLesson } from "@ls/schema/lesson";
import { make_world, type World } from "../../test/support/world.ts";
import { wire_judge } from "../wiring/judge.ts";
import { STUB_JUDGE_NO_MARKER } from "./stub-default-judge.ts";

let w: World;
let n = 400;
beforeAll(async () => {
  w = await make_world();
});
afterAll(async () => {
  await w.close();
});

const hash_of = (l: StoredLesson): string => `sha256:${createHash("sha256").update(JSON.stringify(l)).digest("hex")}`;
const SECTION_NOTE = "OTHER-SECTION-TEXT-QZ";

function mark_first_teaching(l: StoredLesson, text: string): void {
  let done = false;
  for (const s of l.sections) {
    visit_with_parts(s, ({ node, address }) => {
      if (done || node.type !== "paragraph" || !teaching_parts(l).includes(address)) return;
      const t = node.content?.find((c) => typeof c.text === "string");
      if (t !== undefined) {
        t.text = `${t.text} ${text}`;
        done = true;
      }
    });
  }
  if (!done) throw new Error("no teaching paragraph");
}

// Stores a lesson as the check lane leaves it: lesson_doc, a done check_job, and one I/P alignment_link per (code, teaching part).
async function seed(mutate?: (l: StoredLesson) => void, checked = true): Promise<{ id: string; hash: string; lesson: StoredLesson }> {
  const id = `G6.U4.L${++n}`;
  const lesson = { ...wp1(), lesson_id: id } as StoredLesson;
  mutate?.(lesson);
  const hash = hash_of(lesson);
  await w.db.with_tx(async (tx) => {
    await insert_row(tx, "lesson", { id, unit_id: "G6.U4", state: "in_review", last_editor_id: null });
    await insert_row(tx, "lesson_doc", { lesson_id: id, seq: 1, store_id: `st_${id}`, content_hash: hash, derived_json: lesson, stored_by: "usr_synthetic_author" });
    if (checked) {
      await insert_row(tx, "check_job", { lesson_id: id, content_hash: hash, store_id: `st_${id}`, status: "done", finished_at: new Date().toISOString() });
    }
    const parts = teaching_parts(lesson);
    for (const [i, address] of parts.entries()) {
      for (const std of lesson.front_matter.standards) {
        await insert_row(tx, "alignment_link", { lesson_id: id, content_hash: hash, code: std.code, address, role: i === 0 ? "I" : "P", origin: "outline", asserted_by: "outline" });
      }
    }
  });
  return { id, hash, lesson };
}

const loop = (judge?: JudgeClient) => {
  const j = wire_judge(w.deps, judge ? { judge } : {});
  if (j.claim_loop === null) throw new Error("judge disabled");
  return j.claim_loop;
};
// Claims oldest-first across the shared database, so tests drain the queue before asserting on their own lesson.
const drain = async (l: ReturnType<typeof loop>): Promise<void> => {
  for (let i = 0; i < 30; i++) if ((await l.run_once()) === null) return;
};
const rows = (sql: string, p: unknown[] = []) => w.query<Record<string, any>>(sql, p);
const verdicts = (id: string) => rows("select * from judge_verdict where lesson_id=$1 order by address, code", [id]);
const judge_issues = (id: string) => rows("select * from issue where lesson_id=$1 and kind='judge_no'", [id]);
const pair_count = async (id: string) =>
  (await rows("select count(*)::int as c from alignment_link a join standard s on s.code=a.code where a.lesson_id=$1 and a.role in ('I','P')", [id]))[0]!["c"] as number;

class Throwing implements JudgeClient {
  calls = 0;
  async verdict(_: JudgeRequest): Promise<never> {
    this.calls++;
    throw new ProviderError({ kind: "timeout", message: "judge request timed out" });
  }
}

describe("NL-110 judge claim loop", () => {
  it("test_judge_capture", async () => {
    const s = await seed();
    const expected = await pair_count(s.id);
    expect(expected).toBeGreaterThan(0);
    const l = loop();
    await drain(l);
    const v = await verdicts(s.id);
    expect(v).toHaveLength(expected);
    for (const row of v) {
      expect(row["served_model"]).toBe("stub-judge");
      expect(row["content_hash"]).toBe(s.hash);
      const mc = await rows("select * from model_call where id=$1", [row["model_call_id"]]);
      expect(mc[0]!["lesson_id"]).toBe(s.id);
      expect(mc[0]!["purpose"]).toBe("judge");
    }
    // a second claim of the same lesson adds nothing
    expect(await l.run_once()).toBeNull();
    expect(await verdicts(s.id)).toHaveLength(expected);
  });

  it("judge_no_is_advisory", async () => {
    const control = await seed();
    const marked = await seed((l) => mark_first_teaching(l, STUB_JUDGE_NO_MARKER));
    const before = await rows("select level, count(*)::int c from issue where lesson_id in ($1,$2) group by level", [control.id, marked.id]);
    const l = loop();
    await drain(l);
    const issues = await judge_issues(marked.id);
    const no_rows = (await verdicts(marked.id)).filter((x) => x["verdict"] === "no");
    expect(no_rows.length).toBeGreaterThan(0);
    expect(issues).toHaveLength(no_rows.length);
    for (const i of issues) {
      expect(i["level"]).toBe("advisory");
      expect(i["message"]).toContain("Provisional");
      expect(i["content_hash"]).toBe(marked.hash);
    }
    expect(await judge_issues(control.id)).toHaveLength(0);
    const after = await rows("select level, count(*)::int c from issue where lesson_id in ($1,$2) and kind<>'judge_no' group by level", [control.id, marked.id]);
    expect(after).toEqual(before);
  });

  it("judge_unavailable", async () => {
    const s = await seed();
    const bad = new Throwing();
    const l = loop(bad);
    w.lines.length = 0;
    const r = await l.run_once();
    expect(r!.issues_written).toBe(0);
    expect(await verdicts(s.id)).toHaveLength(0);
    expect(await judge_issues(s.id)).toHaveLength(0);
    expect(await rows("select 1 from spend_reservation where status='reserved' and purpose='judge'")).toHaveLength(0);
    const unavailable = w.lines.filter((x) => x.includes("judge.unavailable"));
    expect(unavailable).toHaveLength(1);
    expect(unavailable[0]).toContain(s.id);
    expect(unavailable[0]).toContain(s.hash);
    const calls = bad.calls;
    await l.run_once(); // inside the backoff window: the client is not called again for this lesson
    expect(bad.calls).toBe(calls);
  });

  it("judge_prompt_scope", async () => {
    const s = await seed((l) => {
      mark_first_teaching(l, "ACTIVITY-QZ");
      const other = l.sections.find((x) => x.name === "Wrap Up")!;
      const para = (other.content.content ?? []).find((c) => c.type === "paragraph");
      para!.content = [{ type: "text", text: SECTION_NOTE }];
    });
    await drain(loop());
    const mc = await rows("select * from model_call where lesson_id=$1 and purpose='judge'", [s.id]);
    expect(mc.length).toBeGreaterThan(0);
    for (const m of mc) {
      expect(m["rendered_prompt"]).toContain("ACTIVITY-QZ");
      expect(m["rendered_prompt"]).toContain("v1");
      expect(m["rendered_prompt"]).not.toContain(SECTION_NOTE);
      expect(m["served_model"]).not.toBe("claude-sonnet-5-5");
    }
  });

  it("judge_side_effects", async () => {
    const s = await seed();
    const q = () => rows("select content_hash from lesson_doc where lesson_id=$1 order by seq", [s.id]);
    const links = () => rows("select code, address, role, asserted_by, confirmed_by from alignment_link where lesson_id=$1 order by code, address", [s.id]);
    const [d0, l0] = [await q(), await links()];
    await drain(loop());
    expect(await q()).toEqual(d0);
    expect(await links()).toEqual(l0);
    expect(await judge_issues(s.id)).toHaveLength(0);
  });

  it("judge_price_row", async () => {
    const s = await seed();
    await drain(loop());
    const mc = await rows("select cost_usd from model_call where lesson_id=$1 and purpose='judge'", [s.id]);
    expect(mc.length).toBeGreaterThan(0);
    for (const m of mc) expect(Number(m["cost_usd"])).toBeGreaterThan(0);
  });

  it("skips a hash whose checks have not finished", async () => {
    const s = await seed(undefined, false);
    const r = await loop().run_once();
    expect(r === null || r.lesson_id !== s.id).toBe(true);
    expect(await verdicts(s.id)).toHaveLength(0);
  });

  it("sent_equals_logged", async () => {
    const s = await seed();
    const bodies: string[] = [];
    const fetch_impl = (async (_u: unknown, init: { body: string }) => {
      bodies.push(init.body);
      return new Response(
        JSON.stringify({ id: "x", model: "stub-judge", choices: [{ message: { content: JSON.stringify({ verdict: "no", rationale: "r" }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const adapter = new OpenRouterJudgeAdapter({ api_key: new SecretStr("sk-test-NL110"), model_id: "stub-judge", timeout_ms: 5000, fetch_impl });
    await drain(loop(adapter));
    const mc = await rows("select rendered_prompt from model_call where lesson_id=$1 and purpose='judge' order by attempt", [s.id]);
    expect(bodies.length).toBe(mc.length);
    bodies.forEach((b, i) => expect(JSON.parse(b).messages).toEqual([{ role: "user", content: mc[i]!["rendered_prompt"] }]));
    // an honest "no" is stored as no even when the activity says "answer yes"
    expect((await verdicts(s.id)).every((x) => x["verdict"] === "no")).toBe(true);
    expect(w.lines.join("\n")).not.toContain("sk-test-NL110");
  });

  it("release_on_write_failure", async () => {
    const s = await seed();
    const wiring = wire_judge(w.deps, { judge: new StubJudgeClient([{ verdict: "yes" }, { verdict: "yes" }, { verdict: "yes" }, { verdict: "yes" }]) });
    await w.query("alter table judge_verdict add constraint judge_verdict_block check (lesson_id <> '" + s.id + "') not valid");
    try {
      await wiring.claim_loop!.run_once();
    } finally {
      await w.query("alter table judge_verdict drop constraint judge_verdict_block");
    }
    expect(await rows("select 1 from spend_reservation where status='reserved' and purpose='judge'")).toHaveLength(0);
    expect(await verdicts(s.id)).toHaveLength(0);
  });
});
