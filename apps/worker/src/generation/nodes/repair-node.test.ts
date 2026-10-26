import { describe, expect, it } from "vitest";
import { initial_state } from "@ls/core/pipeline/state";
import type { CheckResult } from "@ls/core/checks/types";
import { parse_repair_findings } from "@ls/prompts/repair-findings";
import type { PaidCallRequest } from "./collaborators.ts";
import type { RecordedCall } from "@ls/core/ports/model-call-log";
import { DraftNode } from "./draft-node.ts";
import { RepairNode } from "./repair-node.ts";
import type { JobContext, JobState } from "./job-state.ts";
import { load_row, make_job, make_renderer, make_repos, make_settings, row_context_of, standard_rows } from "./testing/fixtures.ts";
import { ScriptedPaidCaller } from "./testing/scripted-paid-caller.ts";

const block_of = (req: PaidCallRequest, kind: string) => req.req.user_blocks.find((b) => b.text.includes(`kind=${kind}`))?.text;

/** Throws when the request lacks what a repair needs; otherwise removes only the flagged values. */
class CheckingCaller extends ScriptedPaidCaller {
  constructor() {
    super([]);
  }
  override async call(p: PaidCallRequest): Promise<RecordedCall> {
    for (const name of ["lesson_meta", "repair_findings"])
      if (block_of(p, name) === undefined) throw new Error(`repair_missing_context: ${name}`);
    if (!(block_of(p, "pages") ?? "").includes("pp. 1-8")) throw new Error("repair_missing_context: pages");
    this.requests.push(p);
    const draft = (block_of(p, "repair_draft") ?? "").split("\n").filter((l) => !l.startsWith("<<<")).join("\n");
    let repaired = draft;
    for (const f of parse_repair_findings(block_of(p, "repair_findings")!))
      if (f.matched !== undefined) repaired = repaired.replaceAll(f.matched, "");
    return this.seed_completed(p.ctx.job_id!, "repair", 99, repaired);
  }
}

const findings = [
  { kind: "proper_noun_unsourced", level: "blocking", message: "name not in sources", address: "blocks/2", span_anchor: null, related_lesson_id: null, code: null, matched: "Medusa" },
  { kind: "page_out_of_range", level: "blocking", message: "page outside range", address: "blocks/2", span_anchor: null, related_lesson_id: null, code: "RL.6.1", matched: "p. 999" },
  { kind: "vocabulary_over_cap", level: "advisory", message: "too many words", address: null, span_anchor: null, related_lesson_id: null, code: null },
];
function failing_state(raw: string, extra: Partial<JobState> = {}): { state: JobState; row: ReturnType<typeof load_row> } {
  const row = load_row("wp1");
  const context: JobContext = { row_context: row_context_of(row), standards: standard_rows(row), calls: [], draft_call: null, draft_max_output_tokens: 32000, effort: "high", raw_output: raw, provider_error: null };
  const state: JobState = { ...(initial_state(make_job(), 0) as JobState), context, check_result: { findings } as unknown as CheckResult, ...extra };
  return { state, row };
}

describe("RepairNode request", () => {
  it("repair_request_carries_pinned_context", async () => {
    const caller = new CheckingCaller();
    const { state, row } = failing_state("{}");
    await new RepairNode(caller, make_renderer(), make_repos(row).prompts, make_settings(), caller).run(state);
    const req = caller.requests[0]!;
    const text = req.req.user_blocks.map((b) => b.text).join("\n");
    expect(block_of(req, "pages")).toContain("pp. 1-8");
    expect(block_of(req, "homework")).toContain("Ch. 1 pp. 9-15");
    expect(text).toContain("kind=standard");
    expect(text).toContain("RL.6.1");
    expect(block_of(req, "title")).toContain("The Lightning Thief, Chapter 1");
    expect(block_of(req, "repair_findings")).not.toContain("vocabulary_over_cap");
  });

  it("repair_findings_carry_matched", async () => {
    const caller = new CheckingCaller();
    const { state, row } = failing_state("{}");
    await new RepairNode(caller, make_renderer(), make_repos(row).prompts, make_settings(), caller).run(state);
    const b = block_of(caller.requests[0]!, "repair_findings")!;
    expect(b).toContain('| matched: "Medusa"');
    expect(b).toContain('| matched: "p. 999"');
    expect(b).toContain("| code: RL.6.1");
    expect(b).toContain("@ blocks/2");
  });

  it("repair_preserves_supported_corrects_flagged", async () => {
    const caller = new CheckingCaller();
    const { state, row } = failing_state('{"note":"Percy meets Medusa on p. 999 and p. 3"}');
    const s = await new RepairNode(caller, make_renderer(), make_repos(row).prompts, make_settings(), caller).run(state);
    expect(s.repair_rounds).toBe(1);
    expect(s.context!.raw_output).toContain("Percy");
    expect(s.context!.raw_output).toContain("p. 3");
    expect(s.context!.raw_output).not.toContain("Medusa");
    expect(s.context!.raw_output).not.toContain("p. 999");
  });

  it("repair_includes_compile_error_finding", async () => {
    const caller = new CheckingCaller();
    const { state, row } = failing_state("{}", { compile_error: "COMPILE_ERROR: structure_invalid", check_result: null });
    await new RepairNode(caller, make_renderer(), make_repos(row).prompts, make_settings(), caller).run(state);
    expect(block_of(caller.requests[0]!, "repair_findings")).toContain("compile_error: COMPILE_ERROR: structure_invalid");
  });

  it("repair_request_matches_draft_request_context", async () => {
    const row = load_row("wp1");
    const repos = make_repos(row);
    const dcaller = new ScriptedPaidCaller([{ raw: "{}" }]);
    const job = make_job({ reviewer_note: "make it shorter" });
    const drafted = await new DraftNode(dcaller, make_renderer(), repos.outlines, repos.runs, repos.standards, repos.prompts, make_settings(), dcaller).run(initial_state(job, 0) as JobState);
    const rcaller = new ScriptedPaidCaller([{ raw: "{}" }]);
    await new RepairNode(rcaller, make_renderer(), repos.prompts, make_settings(), rcaller).run({ ...drafted, check_result: { findings } as unknown as CheckResult });
    const d = dcaller.requests[0]!.req.user_blocks;
    const pinned = d.slice(0, -1);
    expect(rcaller.requests[0]!.req.user_blocks.slice(0, pinned.length)).toEqual(pinned);
    expect(pinned.some((b) => b.text.includes("make it shorter"))).toBe(true);
  });

  it("matched_not_in_error_state", async () => {
    const caller = new ScriptedPaidCaller([{ provider_error: "server_error" }]);
    const { state, row } = failing_state("{}");
    const withSeed = { ...state, check_result: { findings: [{ ...findings[0], matched: "ZZ-SEED-NAME" }] } as unknown as CheckResult };
    const s = await new RepairNode(caller, make_renderer(), make_repos(row).prompts, make_settings(), caller).run(withSeed);
    expect(s.context!.provider_error).toBe("server_error");
    expect(JSON.stringify({ brakes_fired: s.brakes_fired, call_ids: s.call_ids, context: { provider_error: s.context!.provider_error } })).not.toContain("ZZ-SEED-NAME");
  });
});

describe("RepairNode", () => {
  it("checkpoint_no_repay", async () => {
    const row = load_row("wp1");
    const caller = new ScriptedPaidCaller([]);
    const job = make_job();
    const stored = caller.seed_completed(job.job_id, "repair", 1, '{"fixed":true}');
    const context: JobContext = { row_context: row_context_of(row), standards: standard_rows(row), calls: [], draft_call: null, draft_max_output_tokens: 32000, effort: "high", raw_output: "{}", provider_error: null };
    const state: JobState = { ...(initial_state(job, 0) as JobState), context };
    const repos = make_repos(row);
    const s = await new RepairNode(caller, make_renderer(), repos.prompts, make_settings(), caller).run(state);
    expect(caller.requests).toHaveLength(0);
    expect(s.repair_rounds).toBe(1);
    expect(s.context!.raw_output).toBe('{"fixed":true}');
    expect(s.call_ids).toEqual([stored.model_call_id]);
  });
});
