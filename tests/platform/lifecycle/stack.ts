// Composition of the real lifecycle services over one test Postgres: the worker generation loop and check runner (from the
// World), a Hocuspocus collab server with its command handler, and the web services (slots, issues, transitions, approvals,
// exports). Rule lists are wrapped by recorders so a test can compare what each stage ran. One stack per test file:
// install_command_handler is process-global.
import { Server } from "@hocuspocus/server";
import { load_collab_settings, load_web_settings } from "@ls/config/settings";
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CHECK_RULES } from "@ls/core/checks/registry";
import type { CheckRuleList } from "@ls/core/checks/types";
import type { RequestUser } from "@ls/core/ports/common";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgExportRepo } from "@ls/db/repos/exports";
import { PgIssueRepo } from "@ls/db/repos/issue-repo";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgMetricsRepo } from "@ls/db/repos/metrics";
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import { PgAlignmentRepo, PgSafetyFlagRepo, PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { seed_users } from "@ls/db/testing/outline-seed";
import { settings_for } from "@ls/db/testing/test-db";
import type { StoredLesson } from "@ls/schema/lesson";
import { create_logger } from "@ls/obs/logger";
import { make_world, AUTHOR, REVIEWER, type World } from "../../../apps/worker/test/support/world.ts";
import { wire_checks } from "../../../apps/worker/src/wiring/checks.ts";
import { CheckJobRunner } from "../../../apps/worker/src/checks/check-job-runner.ts";
import { wire_collab_server, type CollabServerWiring } from "../../../apps/collab/src/wiring/server.ts";
import { wire_collab_commands } from "../../../apps/collab/src/wiring/commands.ts";
import { CollabCommandHandler, install_command_handler } from "../../../apps/collab/src/commands/routes.ts";
import { ApproveService } from "../../../apps/web/src/server/services/approve-service.ts";
import { ExportService } from "../../../apps/web/src/server/services/export-service.ts";
import { IssueService } from "../../../apps/web/src/server/services/issue-service.ts";
import { MetricsWriter } from "../../../apps/web/src/server/services/metrics-writer.ts";
import { SlotService } from "../../../apps/web/src/server/services/slot-service.ts";
import { TransitionService } from "../../../apps/web/src/server/services/transition-service.ts";

export const APPROVER = "usr_synthetic_approver";

export interface RuleCall {
  stage: "generation" | "submit" | "approve";
  lesson_id: string;
  content_hash: string;
  findings: Array<{ kind: string; level: string; address: string | null; code: string | null; matched: string | null }>;
}

/** Wraps every rule so each run is appended to `sink`. `kind` and `level` are kept so generation_rules() can still filter by kind. */
export function recording(rules: CheckRuleList, stage: RuleCall["stage"], sink: RuleCall[]): CheckRuleList {
  return rules.map((r) => ({
    kind: r.kind,
    level: r.level,
    run: (ctx, p) => {
      const out = r.run(ctx, p);
      sink.push({
        stage, lesson_id: ctx.lesson_id as string, content_hash: ctx.content_hash as string,
        findings: out.map((f) => ({ kind: f.kind, level: f.level, address: f.address ?? null, code: f.code ?? null, matched: f.matched ?? null })),
      });
      return out;
    },
  })) as CheckRuleList;
}

let seq = 0;
export class LifecycleStack {
  private constructor(
    readonly calls: RuleCall[],
    readonly world: World,
    readonly server: Server,
    readonly wiring: CollabServerWiring,
    readonly handler: CollabCommandHandler,
    readonly legacy_handler: CollabCommandHandler,
    readonly transitions: TransitionService,
    readonly transitions_legacy: TransitionService,
    readonly approvals: ApproveService,
    readonly slots: SlotService,
    readonly issues: IssueService,
    readonly exports: ExportService,
    readonly check_runner: CheckJobRunner,
    readonly loader: CheckContextLoader,
    private readonly stop_collab: () => Promise<void>,
  ) {}

  static async open(script: (w: World) => void): Promise<LifecycleStack> {
    const calls: RuleCall[] = [];
    const world = await make_world({ rules: recording(CHECK_RULES, "generation", calls) });
    await seed_users(world.db, [{ id: APPROVER, name: "Synthetic Approver", role: "approver" }]);
    script(world);

    const t = world.tdb;
    const logger = create_logger({ service: "collab", build_id: "test", write: () => undefined });
    const base = load_collab_settings({ DATABASE_URL: t.url, COLLAB_INTERNAL_TOKEN: "t-collab" });
    const settings = { ...base, shared: settings_for(t.url, 4), store_debounce_ms: 600_000, store_max_debounce_ms: 1_200_000 };
    const server = new Server({ port: 0, quiet: true, stopOnSignals: false, extensions: [] });
    const d = { settings, logger, db: t.db as never, ids: world.deps.ids, clock: world.deps.clock };
    const wiring = wire_collab_server(d, { hocuspocus: server.hocuspocus });
    await server.listen();
    const commands = wire_collab_commands(d, wiring, { hocuspocus: server.hocuspocus }, { rules: recording(CHECK_RULES, "submit", calls) });
    const handler = commands.handler;
    const legacy_handler = new CollabCommandHandler({ ...handler.deps, rules: [] });

    const rd = { db: world.db, ids: world.deps.ids, clock: world.deps.clock };
    const lessons = new PgLessonRepo(rd);
    const issues_repo = new PgIssueRepo(rd);
    const suggestions = new PgSuggestionRepo(rd);
    const alignment = new PgAlignmentRepo(rd);
    const flags = new PgSafetyFlagRepo(rd);
    const reader = new PgLessonDocReader({ db: world.db });
    const outlines = new PgOutlineRepo(rd);
    const loader = new CheckContextLoader(outlines, new PgStandardRepo(rd), lessons, reader, suggestions, flags, alignment, world.deps.clock);
    const web = load_web_settings({ DATABASE_URL: t.url, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", FOUR_EYES_ENABLED: "false" });
    const metrics = new MetricsWriter(new PgMetricsRepo(rd), web, world.deps.clock);
    const approvals = new ApproveService(
      lessons, lessons, lessons, issues_repo, suggestions, loader, metrics, world.db, world.deps.clock, web, recording(CHECK_RULES, "approve", calls), CHECK_POLICY,
    );
    const audit = new PgAuditLog(rd);
    const s = new LifecycleStack(
      calls, world, server, wiring, handler, legacy_handler,
      new TransitionService(lessons, lessons, approvals, handler as never, world.db, world.deps.logger),
      new TransitionService(lessons, lessons, approvals, legacy_handler as never, world.db, world.deps.logger),
      approvals,
      new SlotService(lessons, handler as never, CHECK_POLICY, lessons),
      new IssueService(issues_repo, new PgCheckQueue(rd), flags, alignment, lessons, handler as never, audit, world.db, world.deps.clock, web, lessons, reader),
      new ExportService(lessons, new PgExportRepo(rd), audit, world.db, world.deps.ids, world.deps.clock, lessons, lessons, outlines),
      wire_checks(world.deps).check_runner,
      loader,
      async () => {
        install_command_handler(null);
        await commands.close();
        await server.destroy();
        await wiring.close();
      },
    );
    return s;
  }

  /** Runs every current rule over a lesson body as the product would load it (used on exported bodies). Not recorded. */
  async recheck(id: string, lesson: StoredLesson, hash: string) {
    const ctx = await this.loader.load(id as never, lesson, hash as never);
    return CHECK_RULES.flatMap((r) => r.run(ctx, CHECK_POLICY));
  }

  user(role: "author" | "reviewer" | "approver"): RequestUser {
    const id = role === "author" ? AUTHOR : role === "reviewer" ? REVIEWER : APPROVER;
    seq += 1;
    return { user_id: id, name: id, email: `${id}@example.test`, role, synthetic: true, request_id: `req_${String(seq).padStart(26, "0")}` } as RequestUser;
  }

  async close(): Promise<void> {
    await this.stop_collab();
    await this.world.close();
  }
}
