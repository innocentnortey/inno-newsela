// NL-89 frozen test (risk::security): AC-7 against a real database. Do not edit.
import { afterAll, describe, expect, it } from "vitest";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { LessonId, ModelCallId, Sha256 } from "@ls/core/ports/common";
import type { NewJudgeVerdict } from "@ls/core/ports/judge";
import { PgJudgeRepo } from "./judge.ts";
import { create_test_db, type TestDb } from "../testing/test-db.ts";

const made: TestDb[] = [];
afterAll(async () => {
  for (const d of made) await d.drop();
});
const H1 = ("sha256:" + "a".repeat(64)) as Sha256;
const H2 = ("sha256:" + "b".repeat(64)) as Sha256;
const pair = (hash: Sha256, n: number): NewJudgeVerdict => ({
  lesson_id: "G6.U4.L4" as LessonId,
  content_hash: hash,
  address: "Lesson.Part1",
  code: "RL.6.1",
  question: "teaches_standard",
  verdict: "yes",
  model_call_id: `mc_synthetic_${n}` as ModelCallId,
  served_model: "judge-model-served",
});

describe("PgJudgeRepo (NL-89)", () => {
  it("append_only_and_per_hash [invariant] AC-7", async () => {
    const t = await create_test_db();
    made.push(t);
    const repo = new PgJudgeRepo({ db: t.db, ids: new PrefixedIdGenerator(), clock: { now: () => new Date(), sleep: async () => {} } });

    const a = await repo.insert_verdict(pair(H1, 1));
    expect(a).toMatchObject({ lesson_id: "G6.U4.L4", code: "RL.6.1", verdict: "yes", served_model: "judge-model-served" });
    expect(typeof a.verdict_id).toBe("string");
    expect(a.created_at).toBeInstanceOf(Date);

    // the same pair on a different content hash coexists
    const b = await repo.insert_verdict(pair(H2, 2));
    expect(b.verdict_id).not.toBe(a.verdict_id);
    const rows = await t.db.with_tx(async (tx) =>
      (await tx.query<{ content_hash: string; model_call_id: string }>(
        "select content_hash, model_call_id from judge_verdict order by content_hash",
      )).rows,
    );
    expect(rows.map((r) => r.content_hash)).toEqual([H1, H2]);
    expect(rows.map((r) => r.model_call_id)).toEqual(["mc_synthetic_1", "mc_synthetic_2"]);

    // negative: UPDATE and DELETE raise, rows unchanged
    await expect(t.db.with_tx((tx) => tx.query("update judge_verdict set verdict = 'no'"))).rejects.toThrow(/append-only: judge_verdict/);
    await expect(t.db.with_tx((tx) => tx.query("delete from judge_verdict"))).rejects.toThrow(/append-only: judge_verdict/);
    const after = await t.db.with_tx(async (tx) => (await tx.query<{ verdict: string }>("select verdict from judge_verdict")).rows);
    expect(after).toHaveLength(2);
    expect(after.every((r) => r.verdict === "yes")).toBe(true);

    // the repo exposes insert only
    expect(Object.getOwnPropertyNames(PgJudgeRepo.prototype).filter((n) => n !== "constructor")).toEqual(["insert_verdict"]);
  });
});
