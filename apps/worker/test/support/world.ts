// NL-79 test world: a migrated Postgres, a seeded outline and prompt, the real wiring on StubModelClient,
// and RunService.start as the only way a run begins. Synthetic data only.
import { readFileSync } from "node:fs";
import Decimal from "decimal.js";
import { load_worker_settings, type WebSettings } from "@ls/config/settings";
import { compute_lesson_links } from "@ls/core/intake/lesson-links";
import { normalize_outline } from "@ls/core/intake/normalize";
import { load_standards_index } from "@ls/core/intake/standards-index";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { ModelClient, StructuredCallRequest } from "@ls/core/ports/model-client";
import type { GateInputs } from "@ls/core/ports/outlines";
import type { RequestUser } from "@ls/core/ports/common";
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CHECK_RULES, run_checks } from "@ls/core/checks/registry";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgIssueRepo } from "@ls/db/repos/issue-repo";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgAlignmentRepo, PgSafetyFlagRepo, PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgJobQueue } from "@ls/db/repos/job-queue";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgModelCallLog } from "@ls/db/repos/model-calls";
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import { PgRunRepo } from "@ls/db/repos/runs";
import { PgSpendLedger } from "@ls/db/repos/spend";
import { seed_standards, seed_users } from "@ls/db/testing/outline-seed";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { PRICE_TABLE } from "@ls/llm/prices";
import { StubModelClient, type StubScriptItem } from "@ls/llm/stub";
import { create_logger } from "@ls/obs/logger";
import { locked_hash, LOCKED_DIR } from "@ls/prompts/locked";
import type { NormalizedRow } from "@ls/schema/outline";
import type { ModelPrice } from "@ls/core/ports/common";
// eslint-disable-next-line boundaries/dependencies -- NL-79 AC mandates RunService.start; test-only, no runtime import
import { RunService } from "../../../web/src/server/services/run-service.ts";
import { load_issued_grid } from "../../../../packages/core/tests/fixtures/outline/index.ts";
import { wire_generation, type GenerationOptions, type GenerationWiring } from "../../src/wiring/generation.ts";
import { valid_plan_json } from "../../src/generation/testing/unit-plan-fakes.ts";
import type { WorkerDeps } from "../../src/deps-types.ts";
import type { ClaimLoop, StopSignal } from "../../src/queue/claim-loop.ts";

export const AUTHOR = "usr_synthetic_author";
export const REVIEWER = "usr_synthetic_reviewer";

const FIXTURES = new URL("../fixtures/stub-drafts/", import.meta.url);
/** A fixture file without its `_`-prefixed header keys. */
export function load_fixture(name: string): { first_draft?: unknown; draft: unknown } {
  const raw = JSON.parse(readFileSync(new URL(name, FIXTURES), "utf8")) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("_"))) as { first_draft?: unknown; draft: unknown };
}
export const text = (v: unknown): StubScriptItem => ({ kind: "text", text: JSON.stringify(v) });

type PriceLookup = NonNullable<GenerationOptions["prices"]>;

export function stub_prices(out_per_mtok = "10.00", in_per_mtok = "2.00"): PriceLookup {
  const make = (model_id: string): ModelPrice => ({
    model_id,
    input_per_mtok: new Decimal(in_per_mtok),
    output_per_mtok: new Decimal(out_per_mtok),
    cache_read_per_mtok: new Decimal("0.20"),
    cache_write_per_mtok: new Decimal("2.50"),
  });
  const prices = [make("stub-model"), make("claude-sonnet-5-5")];
  return { prices, confirmed_on: PRICE_TABLE.confirmed_on, price_for: (id: string) => prices.find((p) => p.model_id === id) ?? PRICE_TABLE.price_for(id) } as PriceLookup;
}

export interface WorldOptions {
  env?: Record<string, string>;
  rules?: readonly unknown[];
  prices?: PriceLookup;
  /** Wraps the stub (e.g. a counting client). Default: the stub itself. */
  wrap?: (inner: StubModelClient) => ModelClient;
  /** Called on every model request before it is answered (e.g. to sample the database at that instant). */
  on_enter?: (req: StructuredCallRequest) => void | Promise<void>;
}

export class World {
  stop: { flag: boolean } & StopSignal = { flag: false, is_set() { return this.flag; } };
  constructor(
    readonly tdb: TestDb,
    readonly deps: WorkerDeps,
    readonly wiring: GenerationWiring,
    readonly stub: StubModelClient,
    readonly lines: string[],
    readonly service: RunService,
    readonly outline_version_id: string,
    readonly prompt_version_id: string,
    readonly rows: NormalizedRow[],
    readonly opts: WorldOptions,
  ) {}

  get db() { return this.tdb.db; }
  get loop(): ClaimLoop { return this.wiring.claim_loop; }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.with_tx(async (tx) => (await tx.query<T & Record<string, unknown>>(sql, params)).rows as T[]);
  }

  user(role: "author" | "reviewer" = "author"): RequestUser {
    const id = role === "author" ? AUTHOR : REVIEWER;
    return { user_id: id, name: id, email: `${id}@example.test`, role, synthetic: true, request_id: "req_1" } as RequestUser;
  }

  /** Starts a run through the real RunService; returns its id. */
  async start_run(rows: number[], cap_usd = 13, role: "author" | "reviewer" = "author"): Promise<string> {
    const run = await this.service.start(
      this.user(role),
      { outline_version_id: this.outline_version_id, mode: "run", scope: { kind: "rows", rows }, prompt_version_id: this.prompt_version_id, cap_usd } as never,
      null,
    );
    return run.run_id;
  }

  row(n: number): NormalizedRow {
    const r = this.rows.find((x) => x.row_number === n);
    if (!r) throw new Error("no row " + n);
    return r;
  }

  /** A second wiring over the same db and stub: a "restarted worker". */
  rewire(): GenerationWiring {
    return wire_generation(this.deps, { ...(this.opts.prices ? { prices: this.opts.prices } : {}), ...(this.opts.rules ? { rules: this.opts.rules as never } : {}) });
  }

  /** Runs `loop` until `pred()` holds (polled every 25 ms) or the timeout passes, then stops it and waits for the drain. */
  async drive_until(pred: () => Promise<boolean>, timeout_ms = 30_000, loop: ClaimLoop = this.loop): Promise<boolean> {
    const stop: StopSignal & { flag: boolean } = { flag: false, is_set() { return this.flag; } };
    const exit = loop.run_until(stop);
    const until = Date.now() + timeout_ms;
    let ok = false;
    try {
      while (Date.now() < until) {
        if (await pred()) { ok = true; break; }
        await new Promise((r) => setTimeout(r, 25));
      }
    } finally {
      stop.flag = true;
      await exit;
    }
    return ok;
  }

  /** The background check lane is NL-81's and not wired here: drive every queued check by hand (claim, run, store). */
  async run_checks_for(): Promise<Array<{ lesson_id: string; findings: number; links: number }>> {
    const base = { db: this.db, ids: this.deps.ids, clock: this.deps.clock };
    const queue = new PgCheckQueue(base);
    const outlines = new PgOutlineRepo(base);
    const lessons = new PgLessonRepo(base);
    const reader = new PgLessonDocReader({ db: this.db });
    const loader = new CheckContextLoader(outlines, new PgStandardRepo(base), lessons, reader, new PgSuggestionRepo(base), new PgSafetyFlagRepo(base), new PgAlignmentRepo(base), this.deps.clock);
    const done: Array<{ lesson_id: string; findings: number; links: number }> = [];
    for (let claimed = await queue.claim(60_000); claimed !== null; claimed = await queue.claim(60_000)) {
      const lesson_id = claimed.lesson_id;
      const doc = await reader.latest_derived(lesson_id);
      if (doc === null) throw new Error("no stored lesson " + lesson_id);
      const ctx = await loader.load(lesson_id, doc.lesson, claimed.content_hash);
      const result = run_checks(ctx, CHECK_RULES, CHECK_POLICY);
      // derive_alignment dedupes on (code, address, role) but alignment_link's key is (lesson, hash, code, address): a CFU in a
      // teaching part yields two rows for one key (follow-up for NL-22/NL-37). Keep the first row per key.
      const links = result.alignment.filter((l, i) => result.alignment.findIndex((x) => x.code === l.code && x.address === l.address) === i);
      await this.db.with_tx(async (tx) => {
        await new PgIssueRepo(base).replace_for_hash(lesson_id, claimed.content_hash, result.findings, tx);
        await new PgAlignmentRepo(base).replace_for_hash(lesson_id, claimed.content_hash, links, tx);
      });
      await queue.finish(claimed);
      done.push({ lesson_id, findings: result.findings.length, links: links.length });
    }
    return done;
  }

  async run_finished(run_id: string): Promise<boolean> {
    const r = await this.query<{ state: string }>("select state from run where id=$1", [run_id]);
    return r[0] !== undefined && !["planning", "running", "queued"].includes(r[0].state);
  }

  async close(): Promise<void> {
    this.stop.flag = true;
    await this.tdb.drop();
  }
}

export async function make_world(opts: WorldOptions = {}): Promise<World> {
  const tdb = await create_test_db({ pool_max: 12, acquire_timeout_ms: 10_000 });
  const db = tdb.db;
  const ids = new PrefixedIdGenerator();
  const clock = new SystemClock();
  const base = { db, ids, clock };
  await seed_standards(db);
  await seed_users(db, [{ id: AUTHOR, name: "Synthetic Author" }, { id: REVIEWER, name: "Synthetic Reviewer", role: "reviewer" }]);

  const outline = normalize_outline(load_issued_grid(), load_standards_index(), 200);
  const outlines = new PgOutlineRepo(base);
  const ov = await db.with_tx((tx) =>
    outlines.insert_version({ unit_id: "G6.U4", sha256: "a".repeat(64), source_kind: "upload_csv", source_name: "issued.csv", uploaded_by: AUTHOR }, outline, compute_lesson_links(outline.rows), tx),
  );
  const prompts = new PgPromptRepo(base);
  const pv = await db.with_tx((tx) => prompts.sync_locked_layer(locked_hash(LOCKED_DIR), tx));
  if (pv === null) throw new Error("prompt v1 not seeded");

  const env = {
    DATABASE_URL: tdb.url, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", MODEL_PROVIDER_MODE: "stub",
    GENERATION_CONCURRENCY: "1", JOB_POLL_MS: "20", ...opts.env,
  };
  const settings = load_worker_settings(env);
  const lines: string[] = [];
  const logger = create_logger({ service: "worker", build_id: "test", level: "info", write: (l) => void lines.push(l) });
  const stub = new StubModelClient({ clock, ...(opts.on_enter ? { on_enter: opts.on_enter } : {}) });
  const deps: WorkerDeps = { settings, logger, db: db as never, ids, clock, model_client: opts.wrap ? opts.wrap(stub) : stub };
  const wiring = wire_generation(deps, { ...(opts.prices ? { prices: opts.prices } : { prices: stub_prices() }), ...(opts.rules ? { rules: opts.rules as never } : {}) });

  // NL-77 (intake choices and the generate gate) is not on main: gate inputs come from the stored outline with no findings.
  const gate_outlines = Object.assign(Object.create(outlines) as PgOutlineRepo, {
    async generate_gate_inputs(id: string): Promise<GateInputs> {
      return { outline: { ...(await outlines.outline(id)), findings: [] }, choices: [] } as GateInputs;
    },
  });
  const service = new RunService(
    new PgRunRepo(base), new PgJobQueue(base), gate_outlines, new PgLessonRepo(base), prompts,
    new PgSpendLedger({ ...base, settings: settings.spend }), new PgModelCallLog(base), new PgAuditLog(base), db, ids, clock,
    { idempotency_window_h: 24 } as WebSettings,
  );
  const rows = (await outlines.rows(ov.outline_version_id)).map((r) => r.row);
  return new World(tdb, deps, wiring, stub, lines, service, ov.outline_version_id, pv.prompt_version_id, rows, { ...opts, prices: opts.prices ?? stub_prices() });
}

/** The lesson id a draft or repair request is for (from the lesson_meta block, or the draft being repaired); "" when neither is there. */
export function lesson_of(req: { user_blocks: ReadonlyArray<{ text: string }> }): string {
  const all = req.user_blocks.map((b) => b.text).join("\n");
  const m = /lesson: (\S+)\s+lesson type/.exec(all) ?? /"lesson_id":\s*"([^"]+)"/.exec(all);
  return m ? m[1]! : "";
}

/** A unit-plan reply for whichever rows the request lists (`kind=row row=N` data blocks). */
export function plan_for(rows: readonly NormalizedRow[], req: { user_blocks: ReadonlyArray<{ text: string }> }): StubScriptItem {
  const all = req.user_blocks.map((b) => b.text).join("\n");
  const wanted = [...all.matchAll(/kind=row row=(\d+)/g)].map((m) => Number(m[1]));
  return { kind: "text", text: valid_plan_json(rows, wanted) };
}
