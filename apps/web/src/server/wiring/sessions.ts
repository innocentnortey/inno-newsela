// NL-25: session sign-in / resolve / sign-out wiring. Constructors must not touch d.db (stub container passes a proxy).
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgSessionRepo } from "@ls/db/repos/sessions";
import type { WebDeps } from "../deps.ts";
import { SessionService } from "../services/session-service.ts";

export interface SessionWiring {
  sessions: SessionService;
}

export function wire_sessions(d: WebDeps): SessionWiring {
  const repo_deps = { db: d.db, ids: d.ids, clock: d.clock };
  return {
    sessions: new SessionService(new PgSessionRepo(repo_deps), new PgAuditLog(repo_deps), d.db, d.clock, d.ids, d.settings, d.logger),
  };
}
