// NL-34 (fills the NL-06 stub). Builds the prompt service and seeds v1 from the locked-layer hash once per process.
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import type { WebDeps } from "../deps.ts";
import { PromptService } from "../services/prompt-service.ts";

export interface PromptWiring {
  prompts: PromptService;
}

export function wire_prompts(d: WebDeps): PromptWiring {
  const shared = { db: d.db, ids: d.ids, clock: d.clock };
  const repo = new PgPromptRepo(shared);
  const audit = new PgAuditLog(shared);
  // The IIFE turns a synchronous throw (the unbuilt stub db) into a rejection; the promise always resolves.
  const ready: Promise<void> = (async () => {
    const { LOCKED_DIR, locked_hash } = await import("@ls/prompts/locked"); // on demand, see PromptService.list
    await d.db.with_tx((tx) => repo.sync_locked_layer(locked_hash(LOCKED_DIR), tx));
  })().catch((e: unknown) => {
    d.logger.error("prompts.sync_failed", { extra: { error_class: e instanceof Error ? e.name : "NonError" } });
  });
  return { prompts: new PromptService(repo, audit, d.db, repo, ready) };
}
