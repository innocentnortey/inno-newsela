import { PgAuditLog } from "@ls/db/repos/audit";
import { PgOutlineRepo, PgStandardRepo } from "@ls/db/repos/outlines";
import type { WebDeps } from "../deps.ts";
import { GoogleSheetsExportFetcher } from "../adapters/google-sheets.ts";
import { OutlineService } from "../services/outline-service.ts";

export interface OutlineWiring {
  outlines: OutlineService;
}

export function wire_outlines(d: WebDeps): OutlineWiring {
  const repo_deps = { db: d.db, ids: d.ids, clock: d.clock };
  const sheets = new GoogleSheetsExportFetcher({
    timeout_ms: d.settings.sheets_fetch_timeout_ms,
    max_bytes: d.settings.outline_max_bytes,
    clock: d.clock,
    base_url: d.settings.sheets_base_url,
  });
  return {
    outlines: new OutlineService(
      new PgOutlineRepo(repo_deps),
      new PgStandardRepo(repo_deps),
      sheets,
      new PgAuditLog(repo_deps),
      d.db,
      d.ids,
      d.clock,
      d.settings,
    ),
  };
}
