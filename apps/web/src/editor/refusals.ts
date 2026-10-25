import * as Y from "yjs";
import { b64_to_bytes, type RefusedMessage } from "./messages";

export interface RefusalOutcome { dropped_updates: number; refused_text: string[]; read_only: true }

export interface EditorHandle {
  /** The local doc holding the refused edits. */
  doc: Y.Doc;
  /** Destroy provider and doc, build a fresh doc that only receives the server state. */
  discard_local_state(): void;
  set_read_only(): void;
}

/** Fail closed: the refused operations live only in the doc that is destroyed, so they can never be re-sent. */
export function apply_refusal(editor: EditorHandle, msg: RefusedMessage): RefusalOutcome {
  let dropped_updates = 0;
  let refused_text: string[] = [];
  try {
    const from = b64_to_bytes(msg.refused_from);
    const refused = Y.encodeStateAsUpdate(editor.doc, from);
    const { structs } = Y.decodeUpdate(refused);
    dropped_updates = structs.length;
    for (const s of structs) {
      const str = (s as { content?: { str?: unknown } }).content?.str;
      if (typeof str === "string" && str !== "") refused_text.push(str);
    }
  } catch {
    dropped_updates = 0;
    refused_text = [];
  }
  editor.discard_local_state();
  editor.set_read_only();
  return { dropped_updates, refused_text, read_only: true };
}
