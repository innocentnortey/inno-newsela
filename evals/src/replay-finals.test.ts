import { describe, expect, it } from "vitest";
import {
  blocked_only_by, calibrate, delta, historical_summary, input_hash, lift_teaching_tags, order_calls, rate_text, select_output, summarize,
  type HistoricalOutcome, type NoOutputReason, type ReplayRecord, type StoredCall, type Which,
} from "./replay-finals.ts";

const f = (kind: string, level = "blocking") => ({ kind, level, address: null, code: null });
const hist = (o: Partial<HistoricalOutcome> = {}): HistoricalOutcome => ({ tile_state: "ready", repairs: 0, truncation_retries: 0, failure_reasons: [], ...o });
const rec = (gen: ReturnType<typeof f>[] | null, review: ReturnType<typeof f>[] | null, o: Partial<ReplayRecord> = {}): ReplayRecord => ({
  lesson: "L", which: "final", status: "ready", source: null, no_output_reason: null, schema_issues: [], compile_error: null, gen, review,
  review_context: "generation_time", identity: null, state_probe: null, historical: hist(), ...o,
});

let n = 0;
const call = (purpose: string, o: Partial<StoredCall> = {}): StoredCall => {
  n += 1;
  return { id: `mc_${String(n).padStart(3, "0")}`, purpose, attempt: 1, status: "completed", stop_reason: "end_turn", raw_output: `${purpose}-${n}`, sent_at: `2026-10-26T10:00:0${n % 10}.000000Z`, ...o };
};
const out = (c: ReturnType<typeof select_output>) => c.raw_output;

describe("select_output", () => {
  it("test_original_is_the_last_usable_draft_even_when_truncated", () => {
    const d = call("lesson_draft", { stop_reason: "max_tokens", sent_at: "2026-10-26T10:00:01.000000Z" });
    const r = call("truncation_retry", { sent_at: "2026-10-26T10:00:02.000000Z" });
    const p = select_output([r, d], "original");
    expect(out(p)).toBe(d.raw_output);
    expect(p.raw_output !== null && p.source.stop_reason).toBe("max_tokens");
  });
  it("test_effective_is_the_truncation_retry_when_the_first_call_hit_max_tokens", () => {
    const d = call("lesson_draft", { stop_reason: "max_tokens", sent_at: "2026-10-26T10:00:01.000000Z" });
    const r = call("truncation_retry", { sent_at: "2026-10-26T10:00:02.000000Z" });
    const p = select_output([d, r], "effective");
    expect(out(p)).toBe(r.raw_output);
    expect(p.raw_output !== null && p.source.purpose).toBe("truncation_retry");
  });
  it("test_effective_is_none_when_the_retry_is_also_truncated", () => {
    const d = call("lesson_draft", { stop_reason: "max_tokens", sent_at: "2026-10-26T10:00:01.000000Z" });
    const r = call("truncation_retry", { stop_reason: "max_tokens", sent_at: "2026-10-26T10:00:02.000000Z" });
    expect(select_output([d, r], "effective")).toEqual({ raw_output: null, reason: "retry_truncated" });
  });
  it("test_effective_ignores_a_stray_retry_when_the_first_call_finished", () => {
    const d = call("lesson_draft", { sent_at: "2026-10-26T10:00:01.000000Z" });
    const r = call("truncation_retry", { sent_at: "2026-10-26T10:00:02.000000Z" });
    expect(out(select_output([d, r], "effective"))).toBe(d.raw_output);
  });
  it("test_final_is_last_repair_else_effective", () => {
    const d = call("lesson_draft", { sent_at: "2026-10-26T10:00:01.000000Z" });
    const rp = call("repair", { sent_at: "2026-10-26T10:00:05.000000Z" });
    expect(out(select_output([d, rp], "final"))).toBe(rp.raw_output);
    expect(out(select_output([d], "final"))).toBe(d.raw_output);
    const t = call("lesson_draft", { stop_reason: "max_tokens", sent_at: "2026-10-26T10:00:01.000000Z" });
    const retry = call("truncation_retry", { sent_at: "2026-10-26T10:00:02.000000Z" });
    // regression: the old pick_output returned the truncated first draft here
    expect(out(select_output([t, retry], "final"))).toBe(retry.raw_output);
    expect(out(select_output([t, retry, rp], "final"))).toBe(rp.raw_output);
  });
  it("test_order_is_sent_at_then_id_whatever_the_input_order", () => {
    const same = "2026-10-26T10:00:00.000000Z";
    const b = call("repair", { id: "mc_b", sent_at: same, raw_output: "b" });
    const c = call("repair", { id: "mc_c", sent_at: same, raw_output: "c" });
    const d = call("lesson_draft", { id: "mc_a", sent_at: "2026-10-26T09:59:59.000000Z", raw_output: "a" });
    for (const input of [[b, c, d], [c, b, d], [d, c, b]]) {
      expect(order_calls(input).map((x) => x.id)).toEqual(["mc_a", "mc_b", "mc_c"]);
      expect(out(select_output(input, "last_repair"))).toBe("c");
    }
  });
  it("test_non_completed_calls_are_ignored", () => {
    const failed = call("lesson_draft", { status: "failed", raw_output: "x" });
    const lost = call("repair", { status: "lost", raw_output: "y" });
    expect(select_output([failed, lost], "original")).toEqual({ raw_output: null, reason: "draft_call_has_no_output" });
    expect(select_output([failed, lost], "last_repair")).toEqual({ raw_output: null, reason: "repair_has_no_output" });
  });
  it("test_no_output_reasons", () => {
    const seen = new Set<NoOutputReason>();
    const add = (calls: StoredCall[], which: Which) => { const p = select_output(calls, which); if (p.raw_output === null) seen.add(p.reason); };
    const trunc = call("lesson_draft", { stop_reason: "max_tokens" });
    add([], "original");
    add([call("lesson_draft", { raw_output: null })], "effective");
    add([trunc], "effective");
    add([trunc, call("truncation_retry", { stop_reason: "max_tokens", sent_at: "2026-10-26T11:00:00.000000Z" })], "effective");
    add([call("lesson_draft")], "last_repair");
    add([call("repair", { raw_output: null })], "last_repair");
    expect([...seen].sort()).toEqual(["draft_call_has_no_output", "no_draft_call", "no_repair_call", "repair_has_no_output", "retry_truncated", "truncated_without_completed_retry"]);
  });
});

describe("summarize and delta", () => {
  const records = [
    rec([], [f("a"), f("a"), f("b", "advisory")]),
    rec([f("a")], [f("a")]),
    rec(null, null),
  ];
  const s = summarize(records);
  it("counts passes only among compiled lessons", () => {
    expect(s).toMatchObject({ lessons: 3, not_compiled: 1, gen_pass: 1, review_pass: 0 });
  });
  it("counts lessons per kind once, blocking only", () => {
    expect(s.review_blocking["a"]).toEqual({ blocking: 3, other: 0, lessons: 2 });
    expect(s.review_blocking["b"]).toBeUndefined();
  });
  it("delta is new minus baseline, zeros dropped", () => {
    const base = summarize([rec([], [f("a")])]).review_blocking;
    expect(delta(base, s.review_blocking)).toEqual({ a: 1 });
  });
  it("test_summary_denominators", () => {
    const rs = [
      rec([], []), rec([f("a")], []),
      rec(null, null, { no_output_reason: "no_draft_call" }),
      rec(null, null, { schema_issues: ["blocks.0"] }),
      rec(null, null, { compile_error: "COMPILE_ERROR: x" }),
    ];
    const t = summarize(rs);
    expect(t).toMatchObject({ lessons: 5, compiled: 2, not_compiled: 3, no_output: 1, schema_invalid: 1, compile_error: 1, gen_pass: 1 });
    expect(t.no_output + t.schema_invalid + t.compile_error).toBe(t.not_compiled);
  });
  it("test_rate_text", () => {
    expect(rate_text(3, { ...s, lessons: 47, compiled: 44 })).toBe("3/47 of all, 3/44 of compiled");
  });
  it("test_blocked_only_by", () => {
    const rs = [rec([f("x"), f("y")], []), rec([f("x")], []), rec([f("z")], []), rec([f("x", "advisory")], []), rec(null, null)];
    expect(blocked_only_by(rs, "gen", ["x", "y"])).toEqual({ failing: 3, only_listed: 2 });
  });
  it("test_historical_summary", () => {
    const rs = [
      rec([], [], { lesson: "a", historical: hist() }),
      rec([], [], { lesson: "b", historical: hist({ repairs: 1 }) }),
      rec([], [], { lesson: "c", historical: hist({ tile_state: "failed" }) }),
      rec([], [], { lesson: "c", which: "effective", historical: hist({ tile_state: "failed" }) }),
    ];
    expect(historical_summary(rs)).toEqual({ lessons: 3, ready: 2, failed: 1, clean_first_pass: 1, repaired: 1 });
  });
  it("test_calibrate_names_the_disagreeing_lessons", () => {
    const rs = [
      rec([], [], { lesson: "a", which: "effective" }),
      rec([f("k")], [], { lesson: "b", which: "effective" }),
      rec([], [], { lesson: "c", which: "effective", historical: hist({ repairs: 1 }) }),
      rec([f("k")], [], { lesson: "d", which: "effective", historical: hist({ repairs: 1 }) }),
      rec([], [], { lesson: "e", which: "final" }),
    ];
    expect(calibrate(rs)).toEqual({ agree: 2, historical_clean_but_replay_fails: ["b"], historical_repaired_but_replay_passes: ["c"] });
  });
  it("test_input_hash_ignores_key_order_and_changes_with_an_output", () => {
    expect(input_hash({ a: 1, b: { c: 2, d: 3 } })).toBe(input_hash({ b: { d: 3, c: 2 }, a: 1 }));
    expect(input_hash({ a: 1 })).not.toBe(input_hash({ a: 2 }));
  });
});

describe("lift_teaching_tags", () => {
  const h = (section: string, codes: string[] = []) => ({ role: "routine_heading", section, part: null, standard_codes: codes, code_origins: codes.map(() => "outline") });
  const t = (section: string, codes: string[]) => ({ role: "teacher_talk", section, part: null, standard_codes: codes, code_origins: codes.map(() => "outline") });
  it("copies teaching codes to the preceding heading in the same section", () => {
    const out = JSON.parse(lift_teaching_tags(JSON.stringify({ blocks: [t("Launch", ["X.1"]), h("Launch"), t("Launch", ["RL.6.1"]), h("Look Back"), t("Look Back", ["W.6.9"])] })));
    expect(out.blocks[2].standard_codes).toEqual(["RL.6.1"]);
    expect(out.blocks[2].code_origins).toEqual(["outline"]);
    expect(out.blocks[4].standard_codes).toEqual(["W.6.9"]);
  });
  it("adds a heading where the section has none and leaves bad JSON alone", () => {
    const out = JSON.parse(lift_teaching_tags(JSON.stringify({ blocks: [h("Launch"), t("Learning in Action", ["RL.6.1"])] })));
    expect(out.blocks[0].standard_codes).toEqual([]);
    expect(out.blocks[1]).toMatchObject({ role: "routine_heading", section: "Learning in Action", standard_codes: ["RL.6.1"] });
    expect(lift_teaching_tags("not json")).toBe("not json");
  });
});
