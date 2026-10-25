// NL-111 (WF-31, S12, R-23): judge calibration against synthetic labels. No provider call is ever made.
import fs from "node:fs";
import path from "node:path";
import { FakeModelCallLog } from "@ls/core/testing/fake-model-call-log";
import { FakeSpendLedger } from "@ls/core/testing/fake-spend";
import { ProviderError } from "@ls/core/errors";
import { StubJudgeClient } from "@ls/llm/stub";
import { describe, expect, it } from "vitest";
import { gate } from "./report.ts";
import { rubric_version } from "./calibrate.ts";
import { run_judge_calibrate } from "./main.ts";
import { FIXTURE, FLIP_4, harness, labels, ordered, scripted_judge } from "./test-support.ts";

const REPORT = "evals/reports/judge-calibration.md";

describe("WF-31", () => {
  it("test_calibration_record", async () => {
    const h = harness({ judge: scripted_judge(FLIP_4) });
    expect(await run_judge_calibrate([], h.deps)).toBe(0);
    const report = h.files.get(REPORT) as string;
    expect(report).toContain("dev agreement: 0.85 (17/20), n=20");
    expect(report).toContain("holdout agreement: 0.90 (9/10), n=10");
    expect(report).toContain("provider stub: not a calibration");
    expect(report).toContain("judge verdicts may be reported: no");
    expect(h.evidence.runs).toHaveLength(1);
    expect(h.evidence.runs[0]).toMatchObject({ suite: "S12", passed: 26, total: 30, report_path: REPORT });
    expect(h.evidence.cases).toHaveLength(30);
    const by_id = new Map(labels().map((r) => [r.pair_id, r.label]));
    for (const c of h.evidence.cases) {
      expect(c.expected).toBe(by_id.get(c.case_id));
      expect(c.source).toBe(`labels.csv:${c.case_id}`);
      expect(c.provenance).toBe("issued");
      expect(c.passed).toBe(c.actual === c.expected);
    }
    expect(h.evidence.cases.filter((c) => c.passed)).toHaveLength(26);
  });

  it("gate_requires_dev_and_holdout", () => {
    expect(gate({ agreed: 17, n: 20 }, { agreed: 7, n: 10 })).toBe(false); // 0.85 / 0.7
    expect(gate({ agreed: 17, n: 20 }, { agreed: 9, n: 10 })).toBe(true); // 0.85 / 0.9
    expect(gate({ agreed: 15, n: 20 }, { agreed: 9, n: 10 })).toBe(false); // 0.75 / 0.9
    expect(gate({ agreed: 16, n: 19 }, { agreed: 10, n: 10 })).toBe(false); // 19 dev labels never reach the gate
    expect(gate({ agreed: 17, n: 20 }, null)).toBe(false);
  });

  it("refuses_short_or_missing_labels", async () => {
    const lines = FIXTURE.trimEnd().split("\n");
    const without = (split: string, drop: number): string => {
      let left = drop;
      return lines.filter((l) => !(l.endsWith(`,${split}`) && left-- > 0)).join("\n") + "\n";
    };
    for (const text of [null, without("dev", 1), without("holdout", 1)]) {
      const stub = scripted_judge([]);
      const h = harness({ labels: text, judge: stub });
      expect(await run_judge_calibrate([], h.deps)).toBe(2);
      expect(stub.calls.length).toBe(0);
      expect(h.evidence.runs).toHaveLength(0);
      expect(h.repos_calls).toBe(0);
      expect(h.err.join("\n")).toMatch(/missing|at least/);
    }
    const dup = harness({ labels: FIXTURE + lines[1] + "\n", judge: scripted_judge([]) });
    expect(await run_judge_calibrate([], dup.deps)).toBe(2);
    expect(dup.err.join()).toContain("duplicate pair_id");
  });

  it("refuses_a_stale_label_or_missing_standard_with_zero_calls", async () => {
    const stub = scripted_judge([]);
    const h = harness({ judge: stub, hash: "f".repeat(64) });
    expect(await run_judge_calibrate([], h.deps)).toBe(2);
    expect(h.err.join()).toContain("stale label");
    expect(stub.calls.length).toBe(0);
    expect(h.evidence.runs).toHaveLength(0);
  });

  it("holdout_scored_after_dev_and_never_tuned", async () => {
    const events: string[] = [];
    const inner = scripted_judge([]);
    const spy = { verdict: async (r: Parameters<StubJudgeClient["verdict"]>[0]) => { events.push(`verdict:${r.address}`); return inner.verdict(r); } };
    const h = harness({ judge: spy, events });
    expect(await run_judge_calibrate([], h.deps)).toBe(0);
    const holdout_addr = labels().filter((r) => r.split === "holdout").map((r) => r.address);
    const dev_addr = labels().filter((r) => r.split === "dev").map((r) => r.address);
    const first_write = events.indexOf("write_report");
    const first_holdout = events.findIndex((e) => holdout_addr.some((a) => e === `verdict:${a}`));
    expect(first_write).toBeGreaterThan(-1);
    expect(first_write).toBeLessThan(first_holdout);
    // before the dev section is written, only dev pairs were judged
    expect(events.slice(0, first_write)).toEqual(dev_addr.map((a) => `verdict:${a}`));
    expect(inner.calls.slice(0, 20).some((r) => holdout_addr.includes(r.address))).toBe(false);
    expect(inner.calls.every((r) => r.rubric_version === rubric_version)).toBe(true);
    expect(rubric_version).toBe("judge-rubric-v1");
    // the module surface that builds prompts takes no labels at all
    const src = fs.readFileSync(path.join(import.meta.dirname, "report.ts"), "utf8");
    expect(src).not.toMatch(/holdout_rows|LabelRow/);
  });

  it("real_mode_requires_cap_within_ceiling", async () => {
    const ledger = new FakeSpendLedger();
    const env = { OPENROUTER_API_KEY: "k", MODEL_JUDGE_ID: "judge-test" };
    for (const argv of [["--real"], ["--real", "--cap-usd", "76"], ["--real", "--cap-usd", "0"]]) {
      const h = harness({ ledger, env });
      expect(await run_judge_calibrate(argv, h.deps)).toBe(2);
      expect(h.real_judge_calls).toBe(0);
      expect(h.call_log.starts).toHaveLength(0);
    }
    const lowered = harness({ ledger, env: { ...env, BUILD_SPEND_CEILING_USD: "1" } });
    expect(await run_judge_calibrate(["--real", "--cap-usd", "2"], lowered.deps)).toBe(2);
    expect(ledger.script.calls.filter((c) => c.method === "reserve")).toHaveLength(0);
    // stub mode writes no spend row and needs no cap
    const stub = harness({ ledger, judge: scripted_judge([]) });
    expect(await run_judge_calibrate([], stub.deps)).toBe(0);
    expect(ledger.script.calls).toHaveLength(0);
    // a missing key is named, never its value
    const nokey = harness({ ledger, env: { MODEL_JUDGE_ID: "judge-test" } });
    expect(await run_judge_calibrate(["--real", "--cap-usd", "2"], nokey.deps)).toBe(2);
    expect(nokey.err.join()).toContain("OPENROUTER_API_KEY");
  });

  it("calls_recorded_and_report_named", async () => {
    const ledger = new FakeSpendLedger();
    const snapshot = {} as never;
    ledger.script
      .returns("reserve", ...Array.from({ length: 30 }, (_, i) => ({ allowed: true, reservation_id: `rsv_${i}`, refused_by: null, scope: null, remaining_usd: null, snapshot }) as never))
      .returns("settle", ...Array.from({ length: 30 }, () => ({}) as never))
      .returns("release", ...Array.from({ length: 30 }, () => ({}) as never));
    const log = new FakeModelCallLog();
    log.script.returns("insert_sent", ...Array.from({ length: 30 }, (_, i) => `mc_${i}` as never)).returns("complete", ...Array.from({ length: 30 }, () => undefined as never));
    const h = harness({ ledger, judge: scripted_judge(FLIP_4), env: { OPENROUTER_API_KEY: "k", MODEL_JUDGE_ID: "judge-test" } });
    const repos = h.deps.repos;
    h.deps.repos = async (real) => ({ ...(await repos(real)), call_log: log });
    expect(await run_judge_calibrate(["--real", "--cap-usd", "5"], h.deps)).toBe(0);
    const starts = log.script.calls.filter((c) => c.method === "insert_sent");
    expect(starts).toHaveLength(30);
    for (const s of starts) expect(s.args[0]).toMatchObject({ purpose: "judge", alias: "JUDGE", requested_model: "judge-test", attempt: 1 });
    const order = [...log.script.calls, ...ledger.script.calls].map((c) => c.method);
    expect(order.filter((m) => m === "reserve")).toHaveLength(30);
    expect(order.filter((m) => m === "settle")).toHaveLength(30);
    expect(order.filter((m) => m === "release")).toHaveLength(30);
    const report = h.files.get(REPORT) as string;
    for (const needle of ["git SHA: abc123def456", "judge model: judge-test", "rubric version: judge-rubric-v1", "n total: 30", "provider mode: real"]) expect(report).toContain(needle);
    expect(report).toContain("judge verdicts may be reported: yes"); // real mode, 0.85 dev and 0.90 holdout
  });

  it("calls_recorded_and_report_named: stub mode inserts before the call, with no reservation", async () => {
    const h = harness({ judge: scripted_judge([]) });
    await run_judge_calibrate([], h.deps);
    expect(h.call_log.starts).toHaveLength(30);
    expect(h.call_log.starts.every((s) => s.reservation_id === null && s.purpose === "judge" && s.alias === "JUDGE")).toBe(true);
    expect(h.call_log.done).toHaveLength(30);
    expect(h.call_log.events.slice(0, 2)).toEqual(["insert_sent", "complete"]);
  });

  it("a provider error is recorded, counted as disagreement and never retried", async () => {
    const script = ordered().map((r, i) => (i === 3 ? new ProviderError({ kind: "timeout" }) : { verdict: r.label }));
    const judge = new StubJudgeClient(script);
    const h = harness({ judge });
    expect(await run_judge_calibrate([], h.deps)).toBe(0);
    expect(judge.calls).toHaveLength(30);
    expect(h.call_log.failed).toHaveLength(1);
    expect(h.evidence.cases.find((c) => c.failure_category === "provider_error")).toMatchObject({ passed: false });
    expect(h.files.get(REPORT)).toContain("dev agreement: 0.95 (19/20)");
  });

  it("no_secrets_or_restricted_text", async () => {
    const marker = "sk-or-marker-KEY-8842";
    const h = harness({ judge: scripted_judge(FLIP_4), env: { OPENROUTER_API_KEY: marker, ANTHROPIC_API_KEY: marker } });
    await run_judge_calibrate([], h.deps);
    const blobs = [...h.files.values(), h.out.join("\n"), h.err.join("\n"), FIXTURE, JSON.stringify(h.evidence.cases), JSON.stringify(h.call_log.starts)];
    for (const b of blobs) {
      expect(b).not.toContain(marker);
      expect(b).not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}/);
      expect(b).not.toMatch(/restricted\//i);
    }
  });
});
