// lock_and_snapshot: the Submit freeze (SP-2 option A). Freeze first, store at once, cover check, checks and gate on the
// stored row, one transaction (snapshot + state + review event), then the read-only broadcast after commit.
import * as Y from "yjs";
import { DomainRefusal } from "@ls/core/errors";
import { decide_transition, is_editable } from "@ls/core/lifecycle/lesson-machine";
import type { SnapshotResult, SubmitCommand } from "@ls/core/ports/collab-commands";
import { covers, StateVectorError } from "@ls/ydoc/hash";
import { open_live_doc, type LiveDoc } from "./live-doc.ts";
import { evaluate_submit_gate } from "./submit-gate.ts";
import type { CollabCommandHandlerDeps } from "./types.ts";

export async function lock_and_snapshot(deps: CollabCommandHandlerDeps, cmd: SubmitCommand): Promise<SnapshotResult> {
  const id = cmd.lesson_id;
  const row = await deps.states.get(id);
  if (row === null) throw new DomainRefusal("NOT_FOUND", "Lesson not found", {});
  const actor_id = cmd.actor.user_id;
  if (actor_id === null) throw new DomainRefusal("INVALID_REQUEST", "A signed-in reviewer is required", {});
  const pre = decide_transition({ action: "submit", role: "reviewer", from_state: row.state });
  if (!pre.allowed) {
    throw new DomainRefusal(pre.refusal ?? "INVALID_TRANSITION", "This lesson cannot be submitted from its current state", { state: row.state });
  }
  // No await between the check and the freeze; a caller that finds it frozen refuses and never releases that freeze.
  deps.frozen.seed(id, row.state);
  if (deps.frozen.is_frozen(id)) throw new DomainRefusal("LESSON_LOCKED", "This lesson is locked", { state: row.state });
  deps.frozen.freeze(id);

  let live: LiveDoc | null = null;
  let released: Parameters<typeof is_editable>[0] | null = null;
  try {
    live = await open_live_doc(deps, id, { actor: cmd.actor, request_id: cmd.request_id });
    // Let updates that passed the write guard just before the freeze land before the encode.
    await new Promise<void>((r) => setImmediate(r));
    // last_editor stays null: Submit is not an edit and must not disturb four-eyes.
    await deps.persistence.store("lesson:" + id, Y.encodeStateAsUpdate(live.doc), null, cmd.request_id);
    const stored = await deps.reader.latest_derived(id);
    if (stored === null) throw new DomainRefusal("NOT_FOUND", "Lesson not found", {});

    let ok: boolean;
    try {
      ok = covers(stored.state_vector, cmd.client_state_vector);
    } catch (e) {
      if (e instanceof StateVectorError) throw new DomainRefusal("INVALID_REQUEST", "The state vector is not valid", {});
      throw e;
    }
    if (!ok) throw new DomainRefusal("NOT_STORED", "Your latest changes were not received; reload and submit again", {});

    await evaluate_submit_gate(deps, id, stored);

    const result = await deps.tx.with_tx(async (tx): Promise<SnapshotResult> => {
      const locked = await deps.states.lock_for_update(id, tx);
      const d = decide_transition({ action: "submit", role: "reviewer", from_state: locked.state });
      if (!d.allowed) {
        throw new DomainRefusal(d.refusal ?? "INVALID_TRANSITION", "This lesson cannot be submitted from its current state", { state: locked.state });
      }
      const v = await deps.versions.write_snapshot(
        { lesson_id: id, kind: "submit", lesson: stored.lesson, content_hash: stored.content_hash, state_vector: stored.state_vector, dependency_record: [], created_by: actor_id },
        tx,
      );
      if (v.content_hash !== stored.content_hash) throw new Error("snapshot hash differs from the stored hash");
      await deps.states.set_state(id, "submitted", locked.reviewer_id, tx);
      const ev = await deps.states.append_review_event(
        { lesson_id: id, version_id: v.version_id, from_state: locked.state, to_state: "submitted", actor_id, reason: null, reason_tag: null, note: null, content_hash: v.content_hash, request_id: cmd.request_id },
        tx,
      );
      return {
        lesson_id: id, version_id: v.version_id, version_number: v.number, content_hash: v.content_hash,
        state_vector: stored.state_vector, review_event_id: ev.review_event_id, from_state: locked.state, to_state: "submitted",
      };
    });

    try {
      deps.acks.mode(id, { mode: "read_only", state: "submitted" });
    } catch {
      deps.logger.warn("collab.submit_broadcast_failed", { request_id: cmd.request_id, lesson_id: id });
    }
    deps.logger.info("collab.submit", { request_id: cmd.request_id, lesson_id: id, extra: { version_number: result.version_number, outcome: "ok" } });
    return result;
  } catch (e) {
    released = await release(deps, id, row.state, cmd);
    throw e;
  } finally {
    if (live !== null) await live.disconnect();
    // Unloading the document forgets the flag (unseeded counts as frozen); a released freeze is seeded again from its editable state.
    if (released !== null) deps.frozen.seed(id, released);
  }
}

/** Release the freeze this call took, unless the lesson has moved to a state that must stay locked. Never throws. */
async function release(deps: CollabCommandHandlerDeps, id: string, pre_state: Parameters<typeof is_editable>[0], cmd: SubmitCommand): Promise<Parameters<typeof is_editable>[0] | null> {
  try {
    let state = pre_state;
    try {
      const cur = await deps.states.get(id);
      if (cur !== null) state = cur.state;
    } catch {
      // keep the pre-read state
    }
    if (!is_editable(state, "reviewer")) return null;
    deps.frozen.unfreeze(id);
    return state;
  } catch {
    deps.logger.warn("collab.submit_release_failed", { request_id: cmd.request_id, lesson_id: id });
    return null;
  }
}
