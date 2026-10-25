import { FakeClock } from "@ls/core/ports/clock";
import type { JobOutcome, JobQueue } from "@ls/core/ports/job-queue";
import type { RunId } from "@ls/core/ports/common";
import { LessonJobRunner } from "../../lesson-job-runner.ts";
import type { RunFinalizerPort } from "../collaborators.ts";
import { CompileCheckNode } from "../compile-check-node.ts";
import { DraftNode } from "../draft-node.ts";
import { FailNode } from "../fail-node.ts";
import { RepairNode } from "../repair-node.ts";
import { StoreNode } from "../store-node.ts";
import { CHECK_POLICY, CHECK_RULES, load_row, make_loader, make_renderer, make_repos, make_settings, type Wp } from "./fixtures.ts";
import { as_ports, make_world } from "./memory-store.ts";
import { ScriptedPaidCaller, type Step } from "./scripted-paid-caller.ts";

// The WP-1 fixture is a compiler fixture with open placeholders and unsourced names, so the full registry
// blocks it for reasons unrelated to repair routing. Runner tests use the structural kinds that the
// good/bad pair differs on; compile-check-node.test.ts runs the full CHECK_RULES.
const RUNNER_KINDS = new Set(["minutes_out_of_range", "section_missing"]);

export function make_harness(script: Step[], wp: Wp = "wp1") {
  const row = load_row(wp);
  const settings = make_settings();
  const caller = new ScriptedPaidCaller(script);
  const world = make_world();
  world.states.seed(row.lesson_id!, "draft"); // ensure_lessons created the row before generation
  const ports = as_ports(world);
  const repos = make_repos(row);
  const clock = new FakeClock();
  const finalized: { run_id: RunId; outcome: JobOutcome }[] = [];
  const finalizer: RunFinalizerPort = { after_job: async (run_id, outcome) => void finalized.push({ run_id, outcome }) };
  const renderer = make_renderer();
  const draft = new DraftNode(caller, renderer, repos.outlines, repos.runs, repos.standards, repos.prompts, settings, caller);
  const compile_check = new CompileCheckNode(make_loader(row), CHECK_RULES.filter((r) => RUNNER_KINDS.has(r.kind)), CHECK_POLICY);
  const repair = new RepairNode(caller, renderer, repos.prompts, settings, caller);
  const store = new StoreNode(ports.versions, ports.states, ports.docs, ports.flags, world.tx);
  const fail = new FailNode(ports.states, ports.versions, world.tx);
  const runner = new LessonJobRunner(draft, compile_check, repair, store, fail, world.queue as unknown as JobQueue, finalizer, clock, settings);
  return { row, settings, caller, world, repos, clock, finalized, draft, compile_check, repair, store, fail, runner };
}
