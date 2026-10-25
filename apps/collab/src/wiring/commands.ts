// Command half of the collab composition: builds CollabCommandHandler and installs it behind the /internal routes.
import { PgDatabase } from "@ls/db/pool";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgStandardRepo } from "@ls/db/repos/outlines";
import { CollabCommandHandler, install_command_handler } from "../commands/routes.ts";
import type { CollabCommandHandlerDeps } from "../commands/types.ts";
import type { CollabDeps } from "../deps-types.ts";
import type { CollabServerWiring, HocuspocusServerRef } from "./server.ts";

export interface CollabCommandWiring {
  handler: CollabCommandHandler;
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
  const built: CollabCommandHandlerDeps = {
    store: new PgLessonDocStore({ ...deps, checks: new PgCheckQueue(deps), states, audit: new PgAuditLog(deps) }),
    reader: new PgLessonDocReader({ db }),
    states,
    versions: states,
    standards: new PgStandardRepo(deps),
    frozen: s.frozen,
    acks: s.acks,
    persistence: s.persistence,
    hocuspocus: h,
    tx: d.db,
    clock: d.clock,
    logger: d.logger,
    token: d.settings.collab_internal_token,
  };
  const handler = new CollabCommandHandler({ ...built, ...given });
  install_command_handler(handler);
  return { handler };
}
