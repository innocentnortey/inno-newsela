// NL-89 frozen tests (risk::security): AC-3 (job half), AC-4, AC-5, AC-6, AC-8, AC-9. Do not edit.
// Stub client, fake ledger, fake call log: no network, no database.
import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import { SecretStr } from "@ls/config/secret";
import { ConfigError } from "@ls/config/errors";
import type { WorkerSettings } from "@ls/config/settings";
import { approve_gate } from "@ls/core/checks/gates";
import { gate_state } from "@ls/core/checks/test-helpers";
import { ProviderError } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import type { LessonId, ModelCallId, ModelPrice, ReservationId, Sha256, UserId } from "@ls/core/ports/common";
import type { JudgeClient, JudgeRequest } from "@ls/core/ports/judge-client";
import type { JudgeRepo, NewJudgeVerdict } from "@ls/core/ports/judge";
import type { ReservationDecision } from "@ls/core/ports/spend";
import { FakeModelCallLog } from "@ls/core/testing/fake-model-call-log";
import { FakeSpendLedger } from "@ls/core/testing/fake-spend";
import { OpenRouterJudgeAdapter } from "@ls/llm/openrouter-judge";
import { StubJudgeClient } from "@ls/llm/stub";
import { JudgeJob, type JudgeJobConfig } from "./judge-job.ts";
import { build_judge_client } from "./judge-client-factory.ts";
import type { JudgePair, JudgePairSource } from "./pair-source.ts";

const LESSON = "G6.U4.L4" as LessonId;
const HASH = ("sha256:" + "a".repeat(64)) as Sha256;
const USER = "usr_synthetic" as UserId;
const PRICE: ModelPrice = {
  model_id: "judge-model",
  input_per_mtok: new Decimal("1"),
  output_per_mtok: new Decimal("5"),
  cache_read_per_mtok: new Decimal("0.1"),
  cache_write_per_mtok: new Decimal("1.25"),
};
const prices = { price_for: (_: string) => PRICE };
const cost = {
  settle_cost: (p: ModelPrice, u: { input_tokens: number; output_tokens: number }) =>
    p.input_per_mtok.mul(u.input_tokens).add(p.output_per_mtok.mul(u.output_tokens)).div(1_000_000),
  max_call_cost: (p: ModelPrice, i: number, o: number) => p.input_per_mtok.mul(i).add(p.output_per_mtok.mul(o)).div(1_000_000),
};
const config: JudgeJobConfig = { expected_locked_hash: "locked-hash-synthetic", rubric_version: "v1", judge_model_id: "judge-model", max_output_tokens: 300 };
const pairs: JudgePair[] = [
  { address: "Lesson.Part1", code: "RL.6.1", activity_text: "Activity one text.", standard_text: "Standard RL.6.1 text.", question: "teaches_standard" },
  { address: "Lesson.Part2", code: "RL.6.2", activity_text: "Activity two text.", standard_text: "Standard RL.6.2 text.", question: "teaches_standard" },
  { address: "Lesson.Part3", code: "L.6.4.b", activity_text: "Activity three text.", standard_text: "Standard L.6.4.b text.", question: "teaches_standard" },
];
const source: JudgePairSource = { load: async () => ({ run_id: null, user_id: USER, pairs }) };
const decision = (allowed: boolean, n: number): ReservationDecision =>
  ({
    allowed,
    reservation_id: allowed ? (`res_${n}` as ReservationId) : null,
    refused_by: allowed ? null : "run_cap",
    scope: null,
    remaining_usd: null,
    snapshot: {},
  }) as unknown as ReservationDecision;

class OrderedCallLog extends FakeModelCallLog {
  constructor(readonly events: string[]) {
    super();
  }
  override async insert_sent(...a: Parameters<FakeModelCallLog["insert_sent"]>) {
    this.events.push("insert_sent");
    return super.insert_sent(...a);
  }
}

function harness(opts: { verdicts: ConstructorParameters<typeof StubJudgeClient>[0]; reserve: boolean[] }) {
  const events: string[] = [];
  const stub = new StubJudgeClient(opts.verdicts);
  const judge: JudgeClient = {
    verdict: async (r: JudgeRequest) => {
      events.push("verdict");
      return stub.verdict(r);
    },
  };
  const calls = new OrderedCallLog(events);
  const spend = new FakeSpendLedger();
  opts.reserve.forEach((a, i) => spend.script.returns("reserve", decision(a, i + 1)));
  const n = opts.reserve.length;
  for (let i = 1; i <= n; i++) calls.script.returns("insert_sent", `mc_${i}` as ModelCallId);
  calls.script.returns("complete", ...Array.from({ length: n }, () => undefined));
  calls.script.returns("fail", ...Array.from({ length: n }, () => undefined));
  const settled = { reservation_id: "x", status: "settled" } as never;
  spend.script.returns("settle", ...Array.from({ length: n }, () => settled));
  spend.script.returns("release", ...Array.from({ length: 2 * n }, () => settled));
  const inserted: NewJudgeVerdict[] = [];
  const verdicts: JudgeRepo = {
    insert_verdict: async (v) => {
      inserted.push(v);
      return { verdict_id: `ev_${inserted.length}`, lesson_id: v.lesson_id, code: v.code, verdict: v.verdict, served_model: v.served_model, created_at: new Date() };
    },
  };
  const render_judge = vi.fn((i: { activity_text: string }) => ({ text: `PROMPT ${i.activity_text}`, input_tokens_estimate: 100 }));
  const job = new JudgeJob(judge, calls, verdicts, { render_judge } as never, spend, prices, cost, source, config, new FakeClock());
  const args = (m: string, store: { script: { calls: readonly { method: string; args: readonly unknown[] }[] } }) =>
    store.script.calls.filter((c) => c.method === m).map((c) => c.args);
  return { job, events, stub, calls, spend, inserted, render_judge, args };
}

describe("JudgeJob (NL-89)", () => {
  it("test_judge_capture [invariant] AC-4 AC-9", async () => {
    const h = harness({ verdicts: [{ verdict: "yes" }, { verdict: "no" }, { verdict: "yes" }], reserve: [true, true, true] });
    const report = await h.job.run(LESSON, HASH);
    expect(report).toMatchObject({ lesson_id: LESSON, pairs: 3, verdicts_no: 1, skipped: 0, failed: 0 });
    expect(Decimal.isDecimal(report.cost_usd)).toBe(true);

    const sent = h.args("insert_sent", h.calls).map((a) => a[0] as Record<string, unknown>);
    expect(sent).toHaveLength(3);
    for (const s of sent) {
      expect(s).toMatchObject({ purpose: "judge", alias: "JUDGE", lesson_id: LESSON, requested_model: "judge-model" });
      expect(String(s["rendered_prompt"]).length).toBeGreaterThan(0);
      expect(s["reservation_id"]).not.toBeNull();
    }
    expect(h.render_judge).toHaveBeenCalledTimes(3);
    expect(h.render_judge.mock.calls[0]![0]).toMatchObject({ expected_locked_hash: "locked-hash-synthetic", rubric_version: "v1" });
    // each insert_sent is committed before its own judge call
    expect(h.events.filter((e) => e !== "").join(",")).toBe("insert_sent,verdict,insert_sent,verdict,insert_sent,verdict");
    expect(h.args("reserve", h.spend).map((a) => (a[0] as { purpose: string }).purpose)).toEqual(["judge", "judge", "judge"]);
    expect(h.stub.calls.map((c) => c.code)).toEqual(["RL.6.1", "RL.6.2", "L.6.4.b"]);

    expect(h.inserted.map((v) => [v.verdict, v.served_model, v.model_call_id, v.code])).toEqual([
      ["yes", "stub-judge", "mc_1", "RL.6.1"],
      ["no", "stub-judge", "mc_2", "RL.6.2"],
      ["yes", "stub-judge", "mc_3", "L.6.4.b"],
    ]);
    expect(h.inserted.every((v) => v.lesson_id === LESSON && v.content_hash === HASH)).toBe(true);
    expect(h.args("complete", h.calls)).toHaveLength(3);
    expect(h.args("fail", h.calls)).toHaveLength(0);
    // no IssueRepo / TxRunner dependency: the ten constructor parameters are the ones the plan lists
    expect(JudgeJob.length).toBe(10);
    expect(Object.keys(report).sort()).toEqual(["cost_usd", "failed", "lesson_id", "pairs", "skipped", "verdicts_no"]);
  });

  it("failed_call_releases_reservation [failure] AC-3", async () => {
    const h = harness({
      verdicts: [new ProviderError({ kind: "timeout" }), new ProviderError({ kind: "rate_limited", retry_after_s: 3 }), { verdict: "yes" }],
      reserve: [true, true, true],
    });
    const report = await h.job.run(LESSON, HASH);
    expect(report).toMatchObject({ pairs: 3, failed: 2, verdicts_no: 0, skipped: 0 });
    expect(h.stub.calls).toHaveLength(3); // no retry, and the job continues
    const failed = h.args("fail", h.calls);
    expect(failed.map((a) => [a[0], (a[1] as { kind: string }).kind])).toEqual([["mc_1", "timeout"], ["mc_2", "rate_limited"]]);
    expect(h.args("complete", h.calls).map((a) => a[0])).toEqual(["mc_3"]);
    const released = h.args("release", h.spend).map((a) => a[0]);
    expect(released).toContain("res_1");
    expect(released).toContain("res_2");
    const settled = h.args("settle", h.spend).map((a) => a[0]);
    expect(settled).not.toContain("res_1");
    expect(settled).not.toContain("res_2");
    expect(h.inserted).toHaveLength(1); // no verdict row for a failed pair
    expect(h.inserted[0]!.model_call_id).toBe("mc_3");
  });

  it("verdicts_never_enter_the_gate [invariant] AC-5", async () => {
    const state = gate_state({ action: "approve" });
    const before = approve_gate(state);
    const h = harness({ verdicts: [{ verdict: "no" }, { verdict: "no" }, { verdict: "no" }], reserve: [true, true, true] });
    const report = await h.job.run(LESSON, HASH);
    expect(report.verdicts_no).toBe(3);
    const after = approve_gate(state);
    expect(after).toEqual(before);
    expect(after.allowed).toBe(true);
    expect(after.refusals).toEqual([]);
    // the job offers no way to write an issue: only the verdict repo is written to
    expect(h.inserted).toHaveLength(3);
  });

  it("spend_refusal_skips_pair_without_call [refusal] AC-6", async () => {
    const h = harness({ verdicts: [{ verdict: "yes" }, { verdict: "no" }], reserve: [true, false, true] });
    const report = await h.job.run(LESSON, HASH);
    expect(report).toMatchObject({ pairs: 3, skipped: 1, failed: 0, verdicts_no: 1 });
    const sent = h.args("insert_sent", h.calls).map((a) => (a[0] as { attempt: number }).attempt);
    expect(sent).toHaveLength(2);
    expect(h.stub.calls.map((c) => c.code)).toEqual(["RL.6.1", "L.6.4.b"]); // the refused pair never reached the judge
    expect(h.inserted.map((v) => v.code)).toEqual(["RL.6.1", "L.6.4.b"]);
    expect(h.args("reserve", h.spend)).toHaveLength(3);
  });
});

describe("build_judge_client (NL-89)", () => {
  const settings = (mode: "real" | "stub", key: string | null, model: string | null) =>
    ({ model: { model_provider_mode: mode }, openrouter_api_key: key === null ? null : new SecretStr(key), model_judge_id: model }) as Pick<
      WorkerSettings,
      "model" | "openrouter_api_key" | "model_judge_id"
    >;
  const KEY = "sk-or-marker-KEY-8842";

  it("adapter_only_in_real_mode_with_key [invariant] AC-8", () => {
    expect(build_judge_client(settings("stub", null, null))).toBeInstanceOf(StubJudgeClient);
    const stub_with_key = build_judge_client(settings("stub", KEY, "m"));
    expect(stub_with_key).toBeInstanceOf(StubJudgeClient);
    expect(stub_with_key).not.toBeInstanceOf(OpenRouterJudgeAdapter);
    expect(build_judge_client(settings("real", KEY, "judge-model"))).toBeInstanceOf(OpenRouterJudgeAdapter);

    // negative: real without a key fails naming the variable
    let err: unknown;
    try {
      build_judge_client(settings("real", null, "judge-model"));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConfigError);
    expect((err as ConfigError).variable).toBe("OPENROUTER_API_KEY");

    // negative: real with a key but no model fails naming the model variable, and never prints the key
    let err2: unknown;
    try {
      build_judge_client(settings("real", KEY, null));
    } catch (e) {
      err2 = e;
    }
    expect(err2).toBeInstanceOf(ConfigError);
    expect((err2 as ConfigError).variable).toBe("MODEL_JUDGE_ID");
    const dump = [(err2 as Error).message, (err2 as Error).stack ?? "", JSON.stringify(err2)].join("\n");
    expect(dump).not.toContain(KEY);
  });
});
