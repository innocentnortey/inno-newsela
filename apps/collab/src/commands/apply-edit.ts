// apply_edit: one tagged Yjs transaction on the live document through a server-side direct connection, stored at once.
import * as Y from "yjs";
import { DomainRefusal } from "@ls/core/errors";
import { is_editable } from "@ls/core/lifecycle/lesson-machine";
import type { EditCommand, StoreAck } from "@ls/core/ports/collab-commands";
import type { StoredLesson } from "@ls/schema/lesson";
import { prepare_edit, type EditPrefetch } from "./edit-doc.ts";
import type { CollabCommandHandlerDeps } from "./types.ts";

interface DirectConn {
  document: Y.Doc | null;
  transact(fn: (doc: Y.Doc) => void): Promise<void>;
  disconnect(): Promise<void>;
}
interface HasDirect {
  openDirectConnection(name: string, context?: unknown): Promise<DirectConn>;
}
function has_direct(x: unknown): x is HasDirect {
  return typeof x === "object" && x !== null && typeof (x as { openDirectConnection?: unknown }).openDirectConnection === "function";
}

export async function apply_edit(deps: CollabCommandHandlerDeps, cmd: EditCommand): Promise<StoreAck> {
  const id = cmd.lesson_id;
  const row = await deps.states.get(id);
  if (row === null) throw new DomainRefusal("NOT_FOUND", "Lesson not found", {});
  // An unseeded lesson counts as frozen; seed is a no-op when a freeze or an earlier connection already set it.
  deps.frozen.seed(id, row.state);
  if (deps.frozen.is_frozen(id) || !is_editable(row.state, "reviewer")) {
    throw new DomainRefusal("LESSON_LOCKED", "This lesson is locked", { state: row.state });
  }

  const pre: EditPrefetch = { candidate: null, standard_text: null };
  const edit = cmd.edit;
  if (edit.kind === "adopt") {
    const v = await deps.versions.candidate(id, edit.candidate_version_id);
    if (v === null) throw new DomainRefusal("NOT_FOUND", "Candidate not found", {});
    pre.candidate = v.lesson as StoredLesson;
  } else if (edit.kind === "standard" && edit.decision === "add") {
    const found = (await deps.standards.texts([edit.code]))[0];
    if (found === undefined) throw new DomainRefusal("NOT_FOUND", "Standard not found", {});
    pre.standard_text = { code: found.code, official_text: found.text };
  }

  if (!has_direct(deps.hocuspocus.hocuspocus)) {
    throw new DomainRefusal("COLLAB_UNAVAILABLE", "The collaboration server is not ready", {});
  }
  const document_name = "lesson:" + id;
  const conn = await deps.hocuspocus.hocuspocus.openDirectConnection(document_name, {
    actor: cmd.actor, tag: cmd.tag, request_id: cmd.request_id,
  });
  try {
    const doc = conn.document;
    if (doc === null) throw new DomainRefusal("COLLAB_UNAVAILABLE", "The document is not loaded", {});
    // The freeze may have landed while the direct connection was opening (SP-2: no edit may be applied after the lock).
    if (deps.frozen.is_frozen(id)) throw new DomainRefusal("LESSON_LOCKED", "This lesson is locked", { state: row.state });
    // Resolve against the live document and mutate in the same tick: a refusal leaves no transaction behind.
    const mutate = prepare_edit(doc, edit, pre);
    await conn.transact(() => mutate());
    const user_id = cmd.actor.user_id;
    const stored = await deps.persistence.store(document_name, Y.encodeStateAsUpdate(doc), user_id, cmd.request_id);
    const ack = stored ?? (await unchanged_ack(deps, id));
    deps.logger.info("collab.edit_applied", { request_id: cmd.request_id, lesson_id: id, store_id: ack.store_id, extra: { tag: cmd.tag } });
    return ack;
  } finally {
    await conn.disconnect();
  }
}

/** The edit changed nothing (for example confirm on an already confirmed code): answer with the latest stored document. */
async function unchanged_ack(deps: CollabCommandHandlerDeps, id: string): Promise<StoreAck> {
  const latest = await deps.reader.latest(id);
  if (latest === null) throw new DomainRefusal("NOT_FOUND", "Lesson not found", {});
  return {
    lesson_id: id, store_id: latest.store_id, seq: latest.seq, content_hash: latest.content_hash,
    state_vector: latest.state_vector, stored_at: latest.stored_at, stored_by: null, check_job_enqueued: false,
  };
}
