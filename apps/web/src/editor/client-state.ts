import * as Y from "yjs";

export type EditorClientState = "connecting" | "synced" | "saving" | "stored" | "DISCONNECTED" | "read_only";

export interface StoredAck { content_hash: string; state_vector: string; stored_at: string }

export interface ClientInputs {
  ever_connected: boolean;
  connected: boolean;
  synced: boolean;
  read_only: boolean;
  dirty: boolean;
}

/** Pure. "stored" needs an ack, so the session upgrades "synced" to "stored"; Submit stays off for saving and DISCONNECTED. */
export function derive_client_state(i: ClientInputs): EditorClientState {
  if (i.read_only) return "read_only";
  if (!i.ever_connected) return "connecting";
  if (!i.connected) return "DISCONNECTED";
  if (!i.synced) return "connecting";
  if (i.dirty) return "saving";
  return "synced";
}

/** An ack counts only when it includes every local operation. */
export function covers(stored_sv: Uint8Array, local_sv: Uint8Array): boolean {
  const stored = Y.decodeStateVector(stored_sv);
  for (const [client, clock] of Y.decodeStateVector(local_sv)) {
    if ((stored.get(client) ?? 0) < clock) return false;
  }
  return true;
}
