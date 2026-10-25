// A19: the judge wiring (NL-110). Construction only: no query and no model call happens until the lane runs.
import { max_call_cost, settle_cost } from "@ls/core/spend/reservation";
import type { JudgeClient } from "@ls/core/ports/judge-client";
import type { PgDatabase } from "@ls/db/pool";
import { PgJudgeRepo } from "@ls/db/repos/judge";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgModelCallLog } from "@ls/db/repos/model-calls";
import { PgStandardRepo } from "@ls/db/repos/outlines";
import { PgSpendLedger } from "@ls/db/repos/spend";
import { JUDGE_MAX_OUTPUT_TOKENS } from "@ls/llm/openrouter-judge";
import { PRICE_TABLE } from "@ls/llm/prices";
import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked";
import { PromptRenderer } from "@ls/prompts/render";
import { SchemaRegistry } from "@ls/prompts/schemas";
import type { WorkerDeps } from "../deps-types.ts";
import { PgAdvisoryIssueWriter } from "../judge/advisory-issue-writer.ts";
import { JudgeClaimLoop } from "../judge/claim-loop.ts";
import { build_judge_client } from "../judge/judge-client-factory.ts";
import { JudgeJob } from "../judge/judge-job.ts";
import { PgJudgePairSource } from "../judge/pg-pair-source.ts";
import { DefaultStubJudge } from "../judge/stub-default-judge.ts";

export const FILLER = "NL-110" as const;

const BACKOFF_MS = 30_000;
const BACKOFF_MAX_MS = 600_000;

export interface JudgeWiring {
  /** null when the judge is not enabled (real mode without a priced MODEL_JUDGE_ID). */
  claim_loop: JudgeClaimLoop | null;
  /** The same object; loops.ts calls lane.run_until(stop). */
  lane: JudgeClaimLoop | null;
}

export function wire_judge(d: WorkerDeps, opts: { judge?: JudgeClient } = {}): JudgeWiring {
  const db = d.db as unknown as PgDatabase;
  const deps = { db, ids: d.ids, clock: d.clock };
  const stub = d.settings.model.model_provider_mode === "stub";
  const judge_model_id = d.settings.model_judge_id ?? "stub-judge";
  const model_id = stub ? "stub-judge" : judge_model_id;
  if (!stub && opts.judge === undefined) {
    try {
      PRICE_TABLE.price_for(model_id);
    } catch {
      d.logger.warn("judge.disabled", { extra: { reason: "unpriced_model" } });
      return { claim_loop: null, lane: null };
    }
  }
  const client = opts.judge ?? (stub ? new DefaultStubJudge() : build_judge_client(d.settings));

  const calls = new PgModelCallLog(deps);
  const spend = new PgSpendLedger({ ...deps, settings: d.settings.spend, logger: d.logger });
  const verdicts = new PgJudgeRepo(deps);
  const renderer = new PromptRenderer(LOCKED_DIR, new SchemaRegistry());
  const source = new PgJudgePairSource({ db, reader: new PgLessonDocReader({ db }), standards: new PgStandardRepo(deps) });
  const job = new JudgeJob(
    client, calls, verdicts, renderer, spend, PRICE_TABLE, { settle_cost, max_call_cost }, source,
    { expected_locked_hash: locked_hash(LOCKED_DIR), rubric_version: "v1", judge_model_id: model_id, max_output_tokens: JUDGE_MAX_OUTPUT_TOKENS },
    d.clock,
  );
  const loop = new JudgeClaimLoop(d.db, job, new PgAdvisoryIssueWriter(deps), d.clock, d.logger, {
    poll_ms: d.settings.check_poll_ms,
    backoff_ms: BACKOFF_MS,
    backoff_max_ms: BACKOFF_MAX_MS,
  });
  return { claim_loop: loop, lane: loop };
}
