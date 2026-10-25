// open_live_doc: the server-side direct connection to the live lesson document (Submit holds it until after commit and broadcast).
import type * as Y from "yjs";
import { DomainRefusal } from "@ls/core/errors";
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

export interface LiveDoc {
  doc: Y.Doc;
  disconnect(): Promise<void>;
}

export async function open_live_doc(deps: CollabCommandHandlerDeps, lesson_id: string, context: unknown): Promise<LiveDoc> {
  if (!has_direct(deps.hocuspocus.hocuspocus)) {
    throw new DomainRefusal("COLLAB_UNAVAILABLE", "The collaboration server is not ready", {});
  }
  const conn = await deps.hocuspocus.hocuspocus.openDirectConnection("lesson:" + lesson_id, context);
  if (conn.document === null) {
    await conn.disconnect();
    throw new DomainRefusal("COLLAB_UNAVAILABLE", "The document is not loaded", {});
  }
  return { doc: conn.document, disconnect: () => conn.disconnect() };
}
