// CandidateService (DO-4 section 5, CON-16). regenerate writes a candidate run, its job and an audit row; adopt hands ONE
// apply_edit to the collaboration server, then flips the `adopted` flag (whole only) and writes one audit row.
// The web process never writes lesson or lesson_version content (WF-13).
import { createHash } from "node:crypto";
import type { WebSettings } from "@ls/config/settings";
import { CollabUnavailable, DomainRefusal } from "@ls/core/errors";
import type { AuditLog } from "@ls/core/ports/audit";
import type { AdoptEdit, CollabCommands } from "@ls/core/ports/collab-commands";
import type {
  Actor,
  LessonId,
  ModelPrice,
  RequestUser,
  RunId,
  Usd,
  VersionId,
} from "@ls/core/ports/common";
import type { JobQueue } from "@ls/core/ports/job-queue";
import type { LessonRow, LessonStateRepo } from "@ls/core/ports/lesson-state";
import type {
  LessonVersionRepo,
  LessonVersionRow,
} from "@ls/core/ports/lesson-versions";
import type { RunRepo } from "@ls/core/ports/runs";
import type { SpendLedger } from "@ls/core/ports/spend";
import type { TxRunner } from "@ls/core/ports/tx";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import type {
  AdoptRequest,
  AdoptResult,
  Candidate,
  RegenerateRequest,
  Section,
} from "@ls/schema/api/lessons";

// Not a DO-4 port: four read methods the existing ports lack (plan NL-47 R1). Implemented by PgCandidateLookup.
export interface CandidateLookup {
  in_flight_run(lesson_id: LessonId): Promise<RunId | null>;
  latest_lesson_run(lesson_id: LessonId): Promise<RunId | null>;
  version_of_run(lesson_id: LessonId, run_id: RunId): Promise<VersionId | null>;
  next_version_number(lesson_id: LessonId): Promise<number>;
}
export interface CandidatePrices {
  price_for(model_id: string): ModelPrice;
}
export interface CandidateCostMath {
  max_call_cost(
    price: ModelPrice,
    input_tokens_estimate: number,
    output_cap: number,
  ): Usd;
}
export interface CandidateApi {
  regenerate(
    user: RequestUser,
    lesson_id: LessonId,
    req: RegenerateRequest,
  ): Promise<Candidate>;
  get(
    user: RequestUser,
    lesson_id: LessonId,
    candidate_id: string,
  ): Promise<Candidate>;
  adopt(
    user: RequestUser,
    lesson_id: LessonId,
    candidate_id: string,
    req: AdoptRequest,
  ): Promise<AdoptResult>;
}

// Output caps mirror the worker settings defaults (DRAFT_OUTPUT_TOKEN_CAP, TRUNCATION_RETRY_TOKEN_CAP); the web process
// cannot read WorkerSettings, so a change there must be repeated here.
export const CANDIDATE_INPUT_TOKENS_ESTIMATE = 20_000;
export const CANDIDATE_DRAFT_OUTPUT_CAP = 32_000;
export const CANDIDATE_TRUNCATION_OUTPUT_CAP = 48_000;
export const CANDIDATE_REPAIR_OUTPUT_CAP = 32_000;
const ALLOWED_STATES: readonly string[] = [
  "generation_failed",
  "in_review",
  "changes_requested",
  "reopened",
];
const NO_CURRENT_HASH = "0".repeat(64); // a lesson with no version yet

function not_found(lesson_id: LessonId, extra: Record<string, string> = {}) {
  return new DomainRefusal("NOT_FOUND", "Lesson not found.", {
    lesson_id,
    ...extra,
  });
}

function job_key(run_id: string, lesson_id: string, prompt_version_id: string) {
  return createHash("sha256")
    .update(
      [run_id, lesson_id, prompt_version_id, String(SCHEMA_VERSION)].join("\n"),
    )
    .digest("hex");
}

function sections_of(v: LessonVersionRow): Section[] {
  return v.lesson.sections.map((s) => ({
    address: s.address,
    name: s.name,
    minutes: s.minutes,
    content: s.content as unknown as Section["content"],
  }));
}

interface View {
  candidate: Candidate;
  version: LessonVersionRow | null;
}

export class CandidateService implements CandidateApi {
  constructor(
    private readonly states: LessonStateRepo,
    private readonly versions: LessonVersionRepo,
    private readonly runs: RunRepo,
    private readonly queue: JobQueue,
    private readonly spend: SpendLedger,
    private readonly collab: CollabCommands,
    private readonly audit: AuditLog,
    private readonly tx: TxRunner,
    private readonly settings: Pick<WebSettings, "model">,
    private readonly lookup: CandidateLookup,
    private readonly prices: CandidatePrices,
    private readonly cost: CandidateCostMath,
  ) {}

  // One lesson's worst case: draft + truncation retry + repair. Never more than the cap the worker checks.
  private candidate_cap(): Usd {
    const gen = this.prices.price_for(this.settings.model.model_generation_id);
    const rep = this.prices.price_for(this.settings.model.model_repair_id);
    const est = CANDIDATE_INPUT_TOKENS_ESTIMATE;
    return this.cost
      .max_call_cost(gen, est, CANDIDATE_DRAFT_OUTPUT_CAP)
      .plus(this.cost.max_call_cost(gen, est, CANDIDATE_TRUNCATION_OUTPUT_CAP))
      .plus(this.cost.max_call_cost(rep, est, CANDIDATE_REPAIR_OUTPUT_CAP));
  }

  private async current_hash(row: LessonRow): Promise<string> {
    if (row.current_version_id === null) return NO_CURRENT_HASH;
    const v = await this.versions.version(row.current_version_id);
    return v?.content_hash ?? NO_CURRENT_HASH;
  }

  private async lesson_row(lesson_id: LessonId): Promise<LessonRow> {
    const row = await this.states.get(lesson_id);
    if (row === null) throw not_found(lesson_id);
    return row;
  }

  async regenerate(
    user: RequestUser,
    lesson_id: LessonId,
    req: RegenerateRequest,
  ): Promise<Candidate> {
    if (user.role !== "reviewer")
      throw new DomainRefusal("ROLE_FORBIDDEN", "Your role cannot do this.");
    const row = await this.lesson_row(lesson_id);
    if (!ALLOWED_STATES.includes(row.state)) {
      throw new DomainRefusal(
        "LESSON_LOCKED",
        "This lesson cannot be regenerated in its current state.",
        { lesson_id, state: row.state },
      );
    }
    const inflight = await this.lookup.in_flight_run(lesson_id);
    if (inflight !== null)
      return (await this.view(lesson_id, row, inflight)).candidate;

    const parent_id = await this.lookup.latest_lesson_run(lesson_id);
    const parent = parent_id === null ? null : await this.runs.get(parent_id);
    if (parent === null)
      throw not_found(lesson_id, { reason: "no_generation_run" });

    const cap = this.candidate_cap();
    const d = await this.spend.check_day_cap(user.user_id, cap);
    if (!d.allowed) {
      throw new DomainRefusal(
        "DAY_CAP_REACHED",
        "Today's spend limit would be passed.",
        {
          scope:
            d.scope ?? (d.refused_by === "project_cap" ? "project" : "user"),
          remaining_usd:
            d.remaining_usd === null ? null : d.remaining_usd.toNumber(),
        },
      );
    }
    const choices = await this.runs.pinned_choices(parent.run_id);
    const plan = await this.runs.unit_plan(parent.run_id);
    const links = plan?.lesson_links ?? [];
    const trimmed = req.note?.trim() ?? "";
    const note = trimmed === "" ? null : trimmed;
    const hash = await this.current_hash(row);

    let run_id: RunId;
    try {
      run_id = await this.tx.with_tx(async (t) => {
        const run = await this.runs.insert_run(
          {
            unit_id: parent.unit_id,
            outline_version_id: parent.outline_version_id,
            kind: "candidate",
            prompt_version_id: parent.prompt_version_id,
            cap_usd: cap,
            scope_rows: null,
            started_by: user.user_id,
            parent_run_id: parent.run_id,
            eval_run_id: null,
            choices,
            choices_hash: parent.choices_hash,
            lesson_links: links,
            idempotency_key: null,
          },
          t,
        );
        await this.queue.create_candidate_job(
          {
            run_id: run.run_id,
            kind: "candidate",
            lesson_id,
            idempotency_key: job_key(
              run.run_id,
              lesson_id,
              parent.prompt_version_id,
            ),
            priority: 0,
            reviewer_note: note,
          },
          t,
        );
        // The note text never goes into the audit row.
        await this.audit.append(
          {
            actor_id: user.user_id,
            action: "candidate.regenerate",
            target_kind: "lesson",
            target_id: lesson_id,
            version_hash:
              row.current_version_id === null ? null : (hash as never),
            reason: null,
            details: {
              run_id: run.run_id,
              parent_run_id: parent.run_id,
              cap_usd: cap.toFixed(6),
              has_note: note !== null,
            },
            request_id: user.request_id as never,
            store_id: null,
          },
          t,
        );
        return run.run_id;
      }, `candidate:${lesson_id}`);
    } catch (e) {
      if (
        e instanceof DomainRefusal &&
        e.code === "INVALID_TRANSITION" &&
        (e.details as { reason?: string } | null)?.reason ===
          "candidate_in_flight"
      ) {
        const winner = await this.lookup.in_flight_run(lesson_id);
        if (winner !== null)
          return (await this.view(lesson_id, row, winner)).candidate;
      }
      throw e;
    }
    return {
      candidate_id: run_id,
      version_number: await this.lookup.next_version_number(lesson_id),
      status: "queued",
      adopted: false,
      failure_reasons: [],
      cost_usd: 0,
      current_content_hash: hash,
      sections: [],
    } as Candidate;
  }

  async get(
    _user: RequestUser,
    lesson_id: LessonId,
    candidate_id: string,
  ): Promise<Candidate> {
    const row = await this.lesson_row(lesson_id);
    return (await this.view(lesson_id, row, candidate_id as RunId)).candidate;
  }

  private async view(
    lesson_id: LessonId,
    row: LessonRow,
    run_id: RunId,
  ): Promise<View> {
    // The same NOT_FOUND for an unknown run and for another lesson's run: nothing reveals the other lesson.
    const miss = () => not_found(lesson_id);
    const run = await this.runs.get(run_id);
    if (run === null) throw miss();
    const job = (await this.queue.jobs_for_run(run_id)).find(
      (j) => j.kind === "candidate" && j.lesson_id === lesson_id,
    );
    if (job === undefined) throw miss();
    const vid = await this.lookup.version_of_run(lesson_id, run_id);
    const version =
      vid === null ? null : await this.versions.candidate(lesson_id, vid);

    let status: Candidate["status"];
    if (version !== null) status = "ready";
    else if (job.status === "queued") status = "queued";
    else if (job.status === "generation_failed" || job.status === "cancelled")
      status = "failed";
    else status = "drafting"; // running, or finished but the version is not visible yet

    const candidate = {
      candidate_id: run_id,
      version_number:
        version?.number ?? (await this.lookup.next_version_number(lesson_id)),
      status,
      adopted: version?.adopted ?? false,
      failure_reasons: status === "failed" ? job.failure_reasons : [],
      cost_usd: (version
        ? version.provenance.cost_usd
        : job.cost_usd
      ).toNumber(),
      current_content_hash: await this.current_hash(row),
      sections: version !== null ? sections_of(version) : [],
    } as Candidate;
    return { candidate, version };
  }

  async adopt(
    user: RequestUser,
    lesson_id: LessonId,
    candidate_id: string,
    req: AdoptRequest,
  ): Promise<AdoptResult> {
    if (user.role !== "reviewer")
      throw new DomainRefusal("ROLE_FORBIDDEN", "Your role cannot do this.");
    const row = await this.lesson_row(lesson_id);
    const { version } = await this.view(lesson_id, row, candidate_id as RunId);

    const address = req.section_address?.trim() ?? "";
    if (req.scope === "section") {
      const bad =
        address === "" ||
        (version !== null &&
          !version.lesson.sections.some((s) => s.address === address));
      if (bad)
        throw new DomainRefusal(
          "INVALID_REQUEST",
          "The request is not valid.",
          {
            fields: ["body.section_address"],
          },
        );
    }
    if (version === null || (req.scope === "whole" && version.adopted)) {
      throw new DomainRefusal(
        "INVALID_TRANSITION",
        "This candidate cannot be adopted.",
        {
          lesson_id,
          reason: version === null ? "not_ready" : "already_adopted",
        },
      );
    }
    const actor: Actor = {
      user_id: user.user_id,
      name: user.name,
      role: user.role,
      synthetic: user.synthetic,
    };
    const edit: AdoptEdit = {
      kind: "adopt",
      candidate_version_id: version.version_id,
      scope: req.scope,
      section_address: req.scope === "section" ? address : null,
    };
    let ack;
    try {
      ack = await this.collab.apply_edit({
        lesson_id,
        actor,
        edit,
        tag: "candidate-adopt",
        request_id: user.request_id,
      });
    } catch (e) {
      if (e instanceof CollabUnavailable)
        throw new DomainRefusal(
          "COLLAB_UNAVAILABLE",
          "The collaboration server could not apply the change. Try again.",
          { lesson_id },
        );
      throw e;
    }
    const audit_id = await this.tx.with_tx(async (t) => {
      if (req.scope === "whole")
        await this.versions.mark_adopted(version.version_id, t);
      return this.audit.append(
        {
          actor_id: user.user_id,
          action: "candidate.adopt",
          target_kind: "lesson",
          target_id: lesson_id,
          version_hash: ack.content_hash,
          reason: null,
          details: {
            candidate_id,
            version_id: version.version_id,
            scope: req.scope,
            section_address: edit.section_address,
          },
          request_id: user.request_id,
          store_id: ack.store_id,
        },
        t,
      );
    });
    return {
      candidate_id,
      audit_id,
      last_editor: user.name,
      content_hash: ack.content_hash,
    } as AdoptResult;
  }
}
