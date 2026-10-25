// set_mode: idempotent. FrozenDocs is updated first, then every connection on the lesson is told.
import { DomainRefusal } from "@ls/core/errors";
import type { ModeCommand, ModeResult } from "@ls/core/ports/collab-commands";
import type { CollabCommandHandlerDeps } from "./types.ts";

export async function set_mode(deps: CollabCommandHandlerDeps, cmd: ModeCommand): Promise<ModeResult> {
  const row = await deps.states.get(cmd.lesson_id);
  if (row === null) throw new DomainRefusal("NOT_FOUND", "Lesson not found", {});
  if (cmd.mode === "read_only") deps.frozen.freeze(cmd.lesson_id);
  else deps.frozen.unfreeze(cmd.lesson_id);
  const connections_notified = deps.acks.mode(cmd.lesson_id, { mode: cmd.mode, state: cmd.state });
  return { lesson_id: cmd.lesson_id, mode: cmd.mode, connections_notified };
}
