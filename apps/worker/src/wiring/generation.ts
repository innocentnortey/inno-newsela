// A9: the generation wiring (NL-79). Construction only: no query and no model call happens until the loop runs.
import type { CheckRule } from "@ls/core/checks/types";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { CHECK_RULES } from "@ls/core/checks/registry";
import { derive_run_state } from "@ls/core/lifecycle/run-machine";
import { max_call_cost, settle_cost } from "@ls/core/spend/reservation";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgJobQueue } from "@ls/db/repos/job-queue";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgModelCallLog } from "@ls/db/repos/model-calls";
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import { PgAlignmentRepo, PgSafetyFlagRepo, PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { PgRunRepo } from "@ls/db/repos/runs";
import { PgSpendLedger } from "@ls/db/repos/spend";
import type { PgDatabase } from "@ls/db/pool";
import { PaidCaller, type CostMath } from "@ls/llm/paid-call";
import { PRICE_TABLE } from "@ls/llm/prices";
import { ModelCallRecorder, type PriceLookup } from "@ls/llm/recorder";
import { LOCKED_DIR } from "@ls/prompts/locked";
import { PromptRenderer } from "@ls/prompts/render";
import { SchemaRegistry } from "@ls/prompts/schemas";
import type { WorkerDeps } from "../deps-types.ts";
import { CompileCheckNode } from "../generation/nodes/compile-check-node.ts";
import { DraftNode } from "../generation/nodes/draft-node.ts";
import { FailNode } from "../generation/nodes/fail-node.ts";
import { RepairNode } from "../generation/nodes/repair-node.ts";
import { StoreNode } from "../generation/nodes/store-node.ts";
import { LessonJobRunner } from "../generation/lesson-job-runner.ts";
import { RunFinalizer } from "../generation/run-finalizer.ts";
import { UnitPlanJob } from "../generation/unit-plan-job.ts";
import { ClaimLoop } from "../queue/claim-loop.ts";

export const FILLER = "NL-79" as const;

// Findings the generation gate must not act on. A draft that fails the gate gets one repair and then fails the lesson,
// so a finding the model can neither cause nor clear would fail every lesson. Each entry is a seam defect found by
// the end-to-end run (NL-79 devlog), not a relaxed policy; the background check lane still raises all of them.
//   quote_placeholder_open, excerpt_slot_open, cross_lesson_link: open slots are generated on purpose (WP-1, WP-2);
//     the reviewer fills them, and L4's homework waits on L5's slot.
//   code_not_allowed: the worker derives front-matter codes from the row, parent codes included, and the rule accepts
//     leaves only (NL-29 front matter vs NL-22 rule).
//   schema_invalid, the two CFU rationale messages only: the compiler writes "A. Correct <why>" and the rule expects the
//     paragraph to start with "Correct" (NL-18 compile vs NL-20 rule).
const NOT_ACTIONABLE_KINDS: ReadonlySet<string> = new Set(["quote_placeholder_open", "excerpt_slot_open", "cross_lesson_link", "code_not_allowed"]);
const CFU_RATIONALE_MESSAGES = /^CFU item (must have exactly one Correct option|is missing a rationale for each option)/;

export function generation_rules(rules: readonly CheckRule[]): CheckRule[] {
  return rules
    .filter((r) => !NOT_ACTIONABLE_KINDS.has(r.kind))
    .map((r) =>
      r.kind === "schema_invalid"
        ? { ...r, run: (ctx, policy) => r.run(ctx, policy).filter((f) => !CFU_RATIONALE_MESSAGES.test(f.message)) }
        : r,
    );
}

export interface GenerationOptions {
  /** Test seam; main.ts passes none. Default: the real price table. */
  prices?: PriceLookup;
  /** Test seam; main.ts passes none. Default: the registered check rules. */
  rules?: readonly CheckRule[];
}
export interface GenerationWiring {
  claim_loop: ClaimLoop;
  paid: PaidCaller;
}

export function wire_generation(d: WorkerDeps, opts: GenerationOptions = {}): GenerationWiring {
  // WorkerDeps.db is typed TxRunner (NL-07); the concrete value is the PgDatabase built by deps.ts.
  const db = d.db as unknown as PgDatabase;
  const deps = { db, ids: d.ids, clock: d.clock };

  const queue = new PgJobQueue(deps);
  const calls = new PgModelCallLog(deps);
  const prices = opts.prices ?? PRICE_TABLE;
  const cost: CostMath = { settle_cost, max_call_cost };
  const recorder = new ModelCallRecorder(d.model_client, calls, d.clock, prices, d.settings.model, cost, { logger: d.logger });
  const spend = new PgSpendLedger({ ...deps, settings: d.settings.spend, logger: d.logger });
  const paid = new PaidCaller(recorder, spend, prices, cost, d.logger);

  const runs = new PgRunRepo(deps);
  const outlines = new PgOutlineRepo(deps);
  const standards = new PgStandardRepo(deps);
  const prompts = new PgPromptRepo(deps);
  const lessons = new PgLessonRepo(deps);
  const flags = new PgSafetyFlagRepo(deps);
  const alignment = new PgAlignmentRepo(deps);
  const suggestions = new PgSuggestionRepo(deps);
  const reader = new PgLessonDocReader({ db });
  const check_queue = new PgCheckQueue(deps);
  const audit = new PgAuditLog(deps);
  const docs = new PgLessonDocStore({ ...deps, checks: check_queue, states: lessons, audit });

  const renderer = new PromptRenderer(LOCKED_DIR, new SchemaRegistry());
  const loader = new CheckContextLoader(outlines, standards, lessons, reader, suggestions, flags, alignment, d.clock);

  const draft = new DraftNode(paid, renderer, outlines, runs, standards, prompts, d.settings, recorder);
  const compile_check = new CompileCheckNode(loader, generation_rules(opts.rules ?? CHECK_RULES), CHECK_POLICY);
  const repair = new RepairNode(paid, renderer, prompts, d.settings, recorder);
  const store = new StoreNode(lessons, lessons, docs, flags, d.db);
  const fail = new FailNode(lessons, lessons, d.db);

  const finalizer = new RunFinalizer(runs, queue, calls, spend, d.db, d.settings, derive_run_state, d.logger);
  const runner = new LessonJobRunner(draft, compile_check, repair, store, fail, queue, finalizer, d.clock, d.settings);
  const plan_job = new UnitPlanJob(paid, renderer, runs, outlines, prompts, d.settings, queue, calls, d.db);
  const claim_loop = new ClaimLoop(queue, calls, spend, runner, plan_job, d.clock, d.logger, d.settings, d.db);
  return { claim_loop, paid };
}
