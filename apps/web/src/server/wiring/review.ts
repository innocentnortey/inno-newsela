// NL-53: review-area wiring. Constructors must not touch d.db (the stub container passes a throwing proxy).
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CHECK_RULES } from "@ls/core/checks/registry";
import { max_call_cost } from "@ls/core/spend/reservation";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCandidateLookup } from "@ls/db/repos/candidate-lookup";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgIssueRepo } from "@ls/db/repos/issue-repo";
import { PgJobQueue } from "@ls/db/repos/job-queue";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgMetricsRepo } from "@ls/db/repos/metrics";
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import { PgAlignmentRepo, PgSafetyFlagRepo, PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { PgRunRepo } from "@ls/db/repos/runs";
import { PgSpendLedger } from "@ls/db/repos/spend";
import { Tx as DbTx } from "@ls/db/tx";
import type { LessonId } from "@ls/core/ports/common";
import type { LessonVersionRow } from "@ls/core/ports/lesson-versions";
import { PRICE_TABLE } from "@ls/llm/prices";
import type { WebDeps } from "../deps.ts";
import { HttpCollabCommandClient } from "../adapters/collab-commands.ts";
import { ApproveService } from "../services/approve-service.ts";
import { CandidateService } from "../services/candidate-service.ts";
import { IssueService } from "../services/issue-service.ts";
import { LessonReadService } from "../services/lesson-read-service.ts";
import { MetricsWriter } from "../services/metrics-writer.ts";
import { SlotService } from "../services/slot-service.ts";
import { TransitionService } from "../services/transition-service.ts";

export interface ReviewWiring {
  lesson_reads: LessonReadService;
  issues: IssueService;
  slots: SlotService;
  candidates: CandidateService;
  transitions: TransitionService;
  approvals: ApproveService;
}

// No collaboration timeout setting exists yet (settings.ts); fall back to 5 s.
const COLLAB_TIMEOUT_MS = 5000;

// LessonReadService.history needs list_for_lesson, which PgLessonRepo does not have (packages/db is not ours to edit).
// Ids come from one query, rows from PgLessonRepo.version, so row mapping stays in one place.
class ListingLessonRepo extends PgLessonRepo {
  readonly #d: WebDeps;
  constructor(d: WebDeps) {
    super({ db: d.db, ids: d.ids, clock: d.clock });
    this.#d = d;
  }
  async list_for_lesson(lesson_id: LessonId): Promise<LessonVersionRow[]> {
    const ids = await this.#d.db.with_tx(async (tx) => {
      if (!(tx instanceof DbTx)) return [] as string[];
      const r = await tx.query("SELECT id FROM lesson_version WHERE lesson_id=$1 ORDER BY number", [lesson_id]);
      return r.rows.map((x) => String(x["id"]));
    });
    const out: LessonVersionRow[] = [];
    for (const id of ids) {
      const v = await this.version(id as never);
      if (v !== null) out.push(v);
    }
    return out;
  }
}

export function wire_review(d: WebDeps): ReviewWiring {
  const rd = { db: d.db, ids: d.ids, clock: d.clock };
  const lessons = new ListingLessonRepo(d);
  const issues_repo = new PgIssueRepo(rd);
  const suggestions = new PgSuggestionRepo(rd);
  const alignment = new PgAlignmentRepo(rd);
  const flags = new PgSafetyFlagRepo(rd);
  const reader = new PgLessonDocReader({ db: d.db });
  const outlines = new PgOutlineRepo(rd);
  const standards = new PgStandardRepo(rd);
  const audit = new PgAuditLog(rd);
  const collab = new HttpCollabCommandClient(
    { base_url: d.settings.collab_internal_url, token: d.settings.collab_internal_token, timeout_ms: COLLAB_TIMEOUT_MS },
    { clock: d.clock, logger: d.logger },
  );

  const lesson_reads = new LessonReadService(lessons, lessons, reader, outlines, alignment, suggestions, audit, issues_repo, flags, lessons);
  const issues = new IssueService(issues_repo, new PgCheckQueue(rd), flags, alignment, lessons, collab, audit, d.db, d.clock, d.settings, lessons, reader);
  const slots = new SlotService(lessons, collab, CHECK_POLICY, lessons);
  const candidates = new CandidateService(
    lessons, lessons, new PgRunRepo(rd), new PgJobQueue(rd),
    new PgSpendLedger({ ...rd, settings: d.settings.spend, logger: d.logger }),
    collab, audit, d.db, d.settings, new PgCandidateLookup(rd), PRICE_TABLE, { max_call_cost },
  );

  const loader = new CheckContextLoader(outlines, standards, lessons, reader, suggestions, flags, alignment, d.clock);
  const metrics_writer = new MetricsWriter(new PgMetricsRepo(rd), d.settings, d.clock);
  const approvals = new ApproveService(
    lessons, lessons, lessons, issues_repo, suggestions, loader, metrics_writer, d.db, d.clock, d.settings, CHECK_RULES, CHECK_POLICY,
  );
  const transitions = new TransitionService(lessons, lessons, approvals, collab, d.db, d.logger);
  return { lesson_reads, issues, slots, candidates, transitions, approvals };
}
