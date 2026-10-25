// NL-102: export-area wiring. Constructors must not touch d.db (the stub container passes a throwing proxy).
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgExportRepo } from "@ls/db/repos/exports";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgOutlineRepo } from "@ls/db/repos/outlines";
import type { WebDeps } from "../deps.ts";
import { ExportService } from "../services/export-service.ts";

export interface ExportWiring {
  exports: ExportService;
}

export function wire_exports(d: WebDeps): ExportWiring {
  const rd = { db: d.db, ids: d.ids, clock: d.clock };
  const lessons = new PgLessonRepo(rd); // serves versions, states and graph
  const exports = new PgExportRepo(rd);
  const audit = new PgAuditLog(rd);
  const units = new PgOutlineRepo(rd); // list_units only
  return { exports: new ExportService(lessons, exports, audit, d.db, d.ids, d.clock, lessons, lessons, units) };
}
