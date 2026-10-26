// Command half of the collab composition: builds CollabCommandHandler and installs it behind the /internal routes.
import { PgDatabase } from "@ls/db/pool";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import { PgIssueRepo } from "@ls/db/repos/issue-repo";
import { PgAlignmentRepo, PgSafetyFlagRepo, PgSuggestionRepo } from "@ls/db/repos/review-extras";
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CHECK_RULES } from "@ls/core/checks/registry";
import { CollabCommandHandler, install_command_handler } from "../commands/routes.ts";
import type { CollabCommandHandlerDeps } from "../commands/types.ts";
import type { CollabDeps } from "../deps-types.ts";
import type { CollabServerWiring, HocuspocusServerRef } from "./server.ts";

export interface CollabCommandWiring {
  handler: CollabCommandHandler;
  /** Uninstall the handler and close this wiring's pool. Safe to call twice. */
  close(): Promise<void>;
}

export function wire_collab_commands(
  d: CollabDeps,
  s: CollabServerWiring,
  h: HocuspocusServerRef,
  given?: Partial<CollabCommandHandlerDeps>,
): CollabCommandWiring {
  // The pool is lazy (no connection until the first query), so the runtime still starts with no database reachable.
  const db = new PgDatabase(d.settings.shared, Math.min(4, d.settings.shared.pg_pool_max), 2000, "collab");
  const deps = { db, ids: d.ids, clock: d.clock };
  const states = new PgLessonRepo(deps);
  const standards = new PgStandardRepo(deps);
  const reader = new PgLessonDocReader({ db });
  const built: CollabCommandHandlerDeps = {
    store: new PgLessonDocStore({ ...deps, checks: new PgCheckQueue(deps), states, audit: new PgAuditLog(deps) }),
    reader,
    states,
    versions: states,
    standards,
    frozen: s.frozen,
    acks: s.acks,
    persistence: s.persistence,
    hocuspocus: h,
    tx: db,
    clock: d.clock,
    logger: d.logger,
    token: d.settings.collab_internal_token,
    loader: new CheckContextLoader(
      new PgOutlineRepo(deps), standards, states, reader, new PgSuggestionRepo(deps), new PgSafetyFlagRepo(deps), new PgAlignmentRepo(deps), d.clock,
    ),
    rules: CHECK_RULES,
    policy: CHECK_POLICY,
    issues: new PgIssueRepo(deps),
  };
  const handler = new CollabCommandHandler({ ...built, ...given });
  install_command_handler(handler);
  let closing: Promise<void> | null = null;
  return {
    handler,
    close: () => {
      closing ??= (async () => {
        install_command_handler(null);
        await db.close();
      })();
      return closing;
    },
  };
}
