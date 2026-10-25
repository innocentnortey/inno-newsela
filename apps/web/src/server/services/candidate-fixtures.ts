// In-memory recording doubles for CandidateService tests (synthetic data only). Plain classes, not Script fakes,
// because AC-1..3 assert row counts. Not a .test.ts, so vitest does not collect it.
import Decimal from "decimal.js";
import { CollabUnavailable, DomainRefusal } from "@ls/core/errors";
import type { AuditLog, NewAuditEvent } from "@ls/core/ports/audit";
import type {
  CollabCommands,
  EditCommand,
  StoreAck,
} from "@ls/core/ports/collab-commands";
import type { ModelPrice, RequestUser, Usd } from "@ls/core/ports/common";
import type { JobQueue, JobRow, NewJob } from "@ls/core/ports/job-queue";
import type { LessonRow, LessonStateRepo } from "@ls/core/ports/lesson-state";
import type {
  LessonVersionRepo,
  LessonVersionRow,
} from "@ls/core/ports/lesson-versions";
import type { NewRun, RunRepo, RunRow, UnitPlanRow } from "@ls/core/ports/runs";
import type { ReservationDecision, SpendLedger } from "@ls/core/ports/spend";
import type { Tx, TxFunction, TxRunner } from "@ls/core/ports/tx";
import {
  CandidateService,
  type CandidateCostMath,
  type CandidateLookup,
  type CandidatePrices,
} from "./candidate-service.ts";

type Any = never; // branded ids: fixtures cast through `never`
export const L4 = "G6.U4.L4";
export const L5 = "G6.U4.L5";
export const H0 = "ab".repeat(32);
export const H1 = "cd".repeat(32);
export const REVIEWER_ID = "usr_synthetic_reviewer";

export const reviewer: RequestUser = {
  user_id: REVIEWER_ID as Any,
  name: "Test reviewer",
  email: "reviewer@example.test",
  role: "reviewer",
  synthetic: true,
  request_id: "req_synthetic_0001" as Any,
};
export const author: RequestUser = {
  ...reviewer,
  user_id: "usr_synthetic_author" as Any,
  name: "Test author",
  email: "author@example.test",
  role: "author",
};

export interface World {
  runs: RunRow[];
  jobs: JobRow[];
  audit: NewAuditEvent[];
  versions: LessonVersionRow[];
  reservations: number;
  lesson: LessonRow;
  collab_calls: EditCommand[];
  collab_down: boolean;
  race: boolean;
  race_winner: { run: RunRow; job: JobRow } | null; // the other request's rows, committed after this tx rolls back
  cap_refusal: { scope: "user" | "project"; remaining: number } | null;
  day_cap_calls: Usd[];
  parent: RunRow;
}

const sections = ["LookBack", "Practice"].map((n, i) => ({
  address: `${L4}.${n}`,
  name: n === "LookBack" ? "Look Back" : "Practice",
  minutes: 5 + i,
  content: { type: "doc", content: [] },
}));

export function version_row(
  over: Partial<LessonVersionRow> = {},
): LessonVersionRow {
  return {
    version_id: "ver_current",
    lesson_id: L4,
    number: 1,
    kind: "generated",
    adopted: false,
    content_hash: H0,
    state_vector: null,
    lesson: {
      lesson_id: L4,
      schema_version: 1,
      title: "synthetic",
      type: "lesson",
      front_matter: { standards: [], minutes_total: 11, vocabulary: [] },
      sections,
      text_cards: [],
    },
    draft: null,
    teacher_word_count: 0,
    provenance: { cost_usd: new Decimal("0.5") },
    dependency_record: [],
    created_by: null,
    stored_at: new Date("2026-10-25T12:00:00Z"),
    ...over,
  } as unknown as LessonVersionRow;
}

export function make_world(state = "in_review"): World {
  const parent = {
    run_id: "run-parent",
    unit_id: "G6.U4",
    outline_version_id: "ov_1",
    kind: "run",
    state: "complete",
    prompt_version_id: "pv_1",
    cap_usd: new Decimal("25"),
    started_by: REVIEWER_ID,
    parent_run_id: null,
    choices_hash: "ef".repeat(32),
  } as unknown as RunRow;
  return {
    runs: [parent],
    jobs: [
      {
        job_id: "job-parent",
        run_id: "run-parent",
        kind: "lesson",
        lesson_id: L4,
        status: "ready",
      } as unknown as JobRow,
    ],
    audit: [],
    versions: [version_row()],
    reservations: 0,
    lesson: {
      lesson_id: L4,
      unit_id: "G6.U4",
      number: 4,
      type: "lesson",
      title: "synthetic",
      state,
      current_version_id: "ver_current",
      reviewer_id: null,
      last_editor_id: null,
      schema_version: 1,
    } as unknown as LessonRow,
    collab_calls: [],
    collab_down: false,
    race: false,
    race_winner: null,
    cap_refusal: null,
    day_cap_calls: [],
    parent,
  };
}

export class RecordingTxRunner implements TxRunner {
  constructor(private readonly w: World) {}
  async with_tx<T>(fn: TxFunction<T>): Promise<T> {
    const w = this.w;
    const snap = {
      runs: [...w.runs],
      jobs: [...w.jobs],
      audit: [...w.audit],
      adopted: w.versions.map((v) => v.adopted),
    };
    try {
      return await fn({} as Tx);
    } catch (e) {
      w.runs = snap.runs;
      w.jobs = snap.jobs;
      w.audit = snap.audit;
      w.versions.forEach((v, i) => (v.adopted = snap.adopted[i] ?? v.adopted));
      if (w.race_winner !== null) {
        w.runs.push(w.race_winner.run);
        w.jobs.push(w.race_winner.job);
        w.race_winner = null;
      }
      throw e;
    }
  }
}

class FakeStates implements Pick<LessonStateRepo, "get"> {
  constructor(private readonly w: World) {}
  async get(id: string) {
    return id === this.w.lesson.lesson_id ? this.w.lesson : null;
  }
}
class FakeRunRepo implements Pick<
  RunRepo,
  "insert_run" | "get" | "pinned_choices" | "unit_plan"
> {
  constructor(private readonly w: World) {}
  async insert_run(run: NewRun) {
    const row = {
      run_id: `run-cand-${this.w.runs.length}`,
      ...run,
      state: "planning",
    } as unknown as RunRow;
    this.w.runs.push(row);
    return row;
  }
  async get(id: string) {
    return this.w.runs.find((r) => r.run_id === id) ?? null;
  }
  async pinned_choices() {
    return [];
  }
  async unit_plan() {
    return { lesson_links: [] } as unknown as UnitPlanRow;
  }
}
class FakeQueue implements Pick<
  JobQueue,
  "create_candidate_job" | "jobs_for_run"
> {
  constructor(private readonly w: World) {}
  async create_candidate_job(job: NewJob) {
    if (this.w.race) {
      // The winner got in first; this insert is refused by the unique index.
      this.w.race_winner = {
        run: { run_id: "run-winner", kind: "candidate" } as unknown as RunRow,
        job: {
          job_id: "job-winner",
          run_id: "run-winner",
          kind: "candidate",
          lesson_id: job.lesson_id,
          status: "queued",
          failure_reasons: [],
          cost_usd: new Decimal(0),
        } as unknown as JobRow,
      };
      throw new DomainRefusal("INVALID_TRANSITION", "Candidate in flight.", {
        reason: "candidate_in_flight",
        lesson_id: job.lesson_id,
      });
    }
    const row = {
      job_id: `job-${this.w.jobs.length}`,
      run_id: job.run_id,
      kind: job.kind,
      lesson_id: job.lesson_id,
      status: "queued",
      failure_reasons: [],
      cost_usd: new Decimal(0),
      reviewer_note: job.reviewer_note,
    } as unknown as JobRow;
    this.w.jobs.push(row);
    return row;
  }
  async jobs_for_run(run_id: string) {
    return this.w.jobs.filter((j) => j.run_id === run_id);
  }
}
class FakeLedger implements Pick<SpendLedger, "check_day_cap"> {
  constructor(private readonly w: World) {}
  async check_day_cap(_u: string, amount: Usd): Promise<ReservationDecision> {
    this.w.day_cap_calls.push(amount);
    const r = this.w.cap_refusal;
    return (r === null
      ? { allowed: true, refused_by: null, scope: null, remaining_usd: null }
      : {
          allowed: false,
          refused_by: r.scope === "user" ? "day_cap" : "project_cap",
          scope: r.scope,
          remaining_usd: new Decimal(r.remaining),
        }) as unknown as ReservationDecision;
  }
}
class FakeVersions implements Pick<
  LessonVersionRepo,
  "version" | "candidate" | "mark_adopted"
> {
  constructor(private readonly w: World) {}
  async version(id: string) {
    return this.w.versions.find((v) => v.version_id === id) ?? null;
  }
  async candidate(lesson_id: string, id: string) {
    return (
      this.w.versions.find(
        (v) =>
          v.version_id === id &&
          v.lesson_id === lesson_id &&
          v.kind === "candidate",
      ) ?? null
    );
  }
  async mark_adopted(id: string) {
    const v = this.w.versions.find((x) => x.version_id === id)!;
    if (v.adopted)
      throw new DomainRefusal("INVALID_TRANSITION", "Already adopted.");
    v.adopted = true;
    return v;
  }
}
class FakeAudit implements Pick<AuditLog, "append"> {
  constructor(private readonly w: World) {}
  async append(e: NewAuditEvent) {
    this.w.audit.push(e);
    return `aud-${this.w.audit.length}` as Any;
  }
}
class FakeCollab implements Pick<CollabCommands, "apply_edit"> {
  constructor(private readonly w: World) {}
  async apply_edit(cmd: EditCommand): Promise<StoreAck> {
    if (this.w.collab_down)
      throw new CollabUnavailable({
        lesson_id: cmd.lesson_id,
        command: "apply_edit",
      });
    this.w.collab_calls.push(cmd);
    return {
      lesson_id: cmd.lesson_id,
      store_id: "st_01HZSYNTHETICSTORE000001",
      seq: 1,
      content_hash: H1,
      state_vector: "AAAA",
      stored_at: new Date("2026-10-25T15:52:00Z"),
      stored_by: REVIEWER_ID,
      check_job_enqueued: true,
    } as unknown as StoreAck;
  }
}
class FakeLookup implements CandidateLookup {
  constructor(private readonly w: World) {}
  async in_flight_run(lesson_id: string) {
    const j = this.w.jobs.find(
      (x) =>
        x.kind === "candidate" &&
        x.lesson_id === lesson_id &&
        (x.status === "queued" || x.status === "running"),
    );
    return (j?.run_id ?? null) as Any;
  }
  async latest_lesson_run(lesson_id: string) {
    const j = [...this.w.jobs]
      .reverse()
      .find((x) => x.kind === "lesson" && x.lesson_id === lesson_id);
    return (j?.run_id ?? null) as Any;
  }
  async version_of_run(lesson_id: string, run_id: string) {
    const v = this.w.versions.find(
      (x) =>
        x.lesson_id === lesson_id &&
        x.kind === "candidate" &&
        x.version_id === `ver-${run_id}`,
    );
    return (v?.version_id ?? null) as Any;
  }
  async next_version_number(lesson_id: string) {
    return (
      Math.max(
        0,
        ...this.w.versions
          .filter((v) => v.lesson_id === lesson_id)
          .map((v) => v.number),
      ) + 1
    );
  }
}

export const fake_prices: CandidatePrices = {
  price_for: (model_id): ModelPrice => ({
    model_id,
    input_per_mtok: new Decimal(2),
    output_per_mtok: new Decimal(10),
    cache_read_per_mtok: new Decimal("0.2"),
    cache_write_per_mtok: new Decimal("2.5"),
  }),
};
// DO-4: ceil6((max(input, cache_write) * est + output * cap) / 1e6)
export const fake_cost: CandidateCostMath = {
  max_call_cost: (p, est, cap) =>
    Decimal.max(p.input_per_mtok, p.cache_write_per_mtok)
      .times(est)
      .plus(p.output_per_mtok.times(cap))
      .div(1_000_000)
      .toDecimalPlaces(6, Decimal.ROUND_UP),
};
export const fake_settings = {
  model: { model_generation_id: "gen-model", model_repair_id: "repair-model" },
} as never;

export function make_service(w: World): CandidateService {
  return new CandidateService(
    new FakeStates(w) as unknown as LessonStateRepo,
    new FakeVersions(w) as unknown as LessonVersionRepo,
    new FakeRunRepo(w) as unknown as RunRepo,
    new FakeQueue(w) as unknown as JobQueue,
    new FakeLedger(w) as unknown as SpendLedger,
    new FakeCollab(w) as unknown as CollabCommands,
    new FakeAudit(w) as unknown as AuditLog,
    new RecordingTxRunner(w),
    fake_settings,
    new FakeLookup(w),
    fake_prices,
    fake_cost,
  );
}

export function seed_inflight(
  w: World,
  status: "queued" | "running" = "queued",
  lesson_id = L4,
): string {
  const run_id = `run-cand-${w.runs.length}`;
  w.runs.push({
    run_id,
    kind: "candidate",
    state: "planning",
  } as unknown as RunRow);
  w.jobs.push({
    job_id: `job-${w.jobs.length}`,
    run_id,
    kind: "candidate",
    lesson_id,
    status,
    failure_reasons: [],
    cost_usd: new Decimal(0),
  } as unknown as JobRow);
  return run_id;
}
export function finish_candidate(w: World, run_id: string): void {
  const j = w.jobs.find((x) => x.run_id === run_id)!;
  j.status = "ready";
  w.versions.push(
    version_row({
      version_id: `ver-${run_id}` as Any,
      number: 2,
      kind: "candidate",
      adopted: false,
      content_hash: H1 as Any,
      provenance: { cost_usd: new Decimal("0.42") } as never,
    }),
  );
}
export function fail_candidate(w: World, run_id: string): void {
  const j = w.jobs.find((x) => x.run_id === run_id)!;
  j.status = "generation_failed";
  j.failure_reasons = [{ check: "truncated" }] as never;
}
