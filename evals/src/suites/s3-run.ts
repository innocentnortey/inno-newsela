// NL-109 (S3): one case-repeat. Builds a fresh world (one test database), scripts the stub or wires the real client,
// starts the run through RunService.start, drives the worker until it finishes, observes, and always drops the database.
// The real branch is written and unit-tested with a fake client factory; it is never run by this ticket.
import { readFileSync } from "node:fs";
import path from "node:path";
import { load_worker_settings, type WorkerSettings } from "@ls/config/settings";
import { InvariantViolation } from "@ls/core/errors";
import { SystemClock } from "@ls/core/ports/clock";
import type { ModelClient } from "@ls/core/ports/model-client";
import { PRICE_TABLE } from "@ls/llm/prices";
import { build_model_client } from "@ls/llm/provider";
import type { EvalOptions } from "../types.ts";
import { REAL_MAX_OUTPUT } from "./s3-guards.ts";
import { observe } from "./s3-observe.ts";
import type { S3Observed } from "./s3-assertions.ts";
import { REPO_ROOT, type S3Input } from "./s3-cases.ts";
import { lesson_of, load_fixture, make_world, plan_for, text, type World, type WorldOptions } from "./s6-world.ts";

export interface S3RunDeps {
  env: Record<string, string | undefined>;
  /** Builds the real client from the worker settings; injectable so the real branch is testable without a key or a call. */
  make_client?: (settings: WorkerSettings) => ModelClient;
  make_world?: (opts: WorldOptions) => Promise<World>;
  /** Cap for RunService.start in USD (real mode); the default is the stub-friendly 2. */
  cap_usd?: number;
}

type Draft = { lesson_id?: string; blocks: { role: string; standard_codes: string[]; code_origins: string[] }[] };

/** A leaf code (`W.6.2.a`) under a listed parent is `narrowed`, not `outline` (HP-3). Everything else is kept. */
export function narrow_leaf_origins(d: unknown): unknown {
  const x = structuredClone(d) as Draft;
  for (const b of x.blocks) b.code_origins = b.standard_codes.map((c, i) => (/\.[a-z]$/.test(c) ? "narrowed" : (b.code_origins[i] ?? "outline")));
  return x;
}

const strip_notes = (o: object): object => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
export function read_draft_file(p: string): object {
  const abs = path.isAbsolute(p) ? p : path.resolve(REPO_ROOT, p);
  try {
    return strip_notes(JSON.parse(readFileSync(abs, "utf8")) as object);
  } catch {
    throw new InvariantViolation("S3 --stub-draft file is missing or is not JSON", { path: p });
  }
}

/** The stub draft per case: WP-1 starts defective and is repaired once; WP-2 is healthy; WP-3 is the hand-written Flex Day. */
export function stub_drafts(case_id: string, override: object | null): { first: object; repair: object } {
  if (override !== null) return { first: override, repair: override };
  if (case_id === "wp-3") {
    const good = read_draft_file("evals/cases/drafts/_fixtures/good-wp-3.json");
    return { first: good, repair: good };
  }
  const fx = load_fixture(`${case_id}.json`);
  const draft = narrow_leaf_origins(fx.draft) as object;
  return { first: fx.first_draft === undefined ? draft : (narrow_leaf_origins(fx.first_draft) as object), repair: draft };
}

export async function run_case(case_id: string, input: S3Input, opts: EvalOptions, deps: S3RunDeps): Promise<S3Observed> {
  const real = opts.provider_mode === "real";
  const key = deps.env["ANTHROPIC_API_KEY"];
  if (real && (key === undefined || key.trim() === "")) {
    throw new InvariantViolation("S3 real run needs ANTHROPIC_API_KEY (run it under bin/with-provider-env)");
  }
  const override = !real && opts.stub_draft ? read_draft_file(opts.stub_draft) : null;
  const make = deps.make_world ?? make_world;
  const env: Record<string, string> = { GENERATION_CONCURRENCY: real ? "6" : "1" };
  let client: ModelClient | undefined;
  if (real) {
    const settings = load_worker_settings({
      ...env, DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unused", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t",
      MODEL_PROVIDER_MODE: "real", ANTHROPIC_API_KEY: key as string, MODEL_EFFORT: "low", DRAFT_OUTPUT_TOKEN_CAP: String(REAL_MAX_OUTPUT),
    });
    client = (deps.make_client ?? ((s: WorkerSettings) => build_model_client(s.model, new SystemClock())))(settings);
  }
  const w = await make({ env: { ...env, ...(real ? { MODEL_EFFORT: "low", DRAFT_OUTPUT_TOKEN_CAP: String(REAL_MAX_OUTPUT) } : {}) }, ...(client ? { client, prices: PRICE_TABLE } : {}) });
  try {
    const row = w.row(input.sheet_row);
    if (row.lesson_id !== input.lesson_id) {
      throw new InvariantViolation("S3 case row does not name the expected lesson", { case_id, sheet_row: input.sheet_row, expected: input.lesson_id, found: row.lesson_id });
    }
    if (!real) {
      const d = stub_drafts(case_id, override);
      const script = (body: object) => (req: Parameters<typeof lesson_of>[0]) => text({ ...body, lesson_id: lesson_of(req) });
      w.stub.script("GENERATION", "unit_plan", (req) => plan_for(w.rows, req));
      w.stub.script("GENERATION", "lesson_draft", script(d.first));
      w.stub.script("REPAIR", "lesson_draft", script(d.repair));
    }
    const run_id = await w.start_run([input.sheet_row], deps.cap_usd ?? 2);
    const finished = await w.drive_until(() => w.run_finished(run_id), real ? 30 * 60_000 : 120_000);
    if (!finished) throw new InvariantViolation("S3 run did not finish in time", { case_id });
    return await observe(w, run_id, input.lesson_id);
  } finally {
    await w.close();
  }
}
