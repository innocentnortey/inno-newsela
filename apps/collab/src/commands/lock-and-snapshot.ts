// NL-106 replaces the body of lock_and_snapshot; NL-105 only types the export the handler dispatches to.
import { DomainRefusal } from "@ls/core/errors";
import type { SnapshotResult, SubmitCommand } from "@ls/core/ports/collab-commands";
import type { CollabCommandHandlerDeps } from "./types.ts";

export const FILLER = "NL-106" as const;

export async function lock_and_snapshot(_deps: CollabCommandHandlerDeps, _cmd: SubmitCommand): Promise<SnapshotResult> {
  throw new DomainRefusal("COLLAB_UNAVAILABLE", "The Submit freeze is not available yet", {});
}
