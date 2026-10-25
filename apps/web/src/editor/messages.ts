// CON-12 server messages (stateless JSON strings). Parsing never throws and never evaluates anything.
export type CollabMode = "editable" | "read_only";
export interface StoredMessage { type: "stored"; content_hash: string; state_vector: string; stored_at: string }
export interface ModeMessage { type: "mode"; mode: CollabMode; state: string }
export interface RefusedMessage { type: "refused"; code: "LESSON_LOCKED"; message: string; refused_from: string }
export type CollabMessage = StoredMessage | ModeMessage | RefusedMessage;

const isStr = (v: unknown): v is string => typeof v === "string";

export function parse_collab_message(payload: string): CollabMessage | null {
  let v: unknown;
  try {
    v = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.type === "stored" && isStr(o.content_hash) && isStr(o.state_vector) && isStr(o.stored_at)) {
    return { type: "stored", content_hash: o.content_hash, state_vector: o.state_vector, stored_at: o.stored_at };
  }
  if (o.type === "mode" && (o.mode === "editable" || o.mode === "read_only") && isStr(o.state)) {
    return { type: "mode", mode: o.mode, state: o.state };
  }
  if (o.type === "refused" && o.code === "LESSON_LOCKED" && isStr(o.message) && isStr(o.refused_from)) {
    return { type: "refused", code: "LESSON_LOCKED", message: o.message, refused_from: o.refused_from };
  }
  return null;
}

export function b64_to_bytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytes_to_b64(u: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]!);
  return btoa(bin);
}
