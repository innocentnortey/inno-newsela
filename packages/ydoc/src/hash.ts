import * as Y from "yjs";
import type { StateVector } from "@ls/schema/ids";

export { content_hash } from "@ls/schema/content-hash";

export class StateVectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateVectorError";
  }
}

/** Base64 state vector of the document encoded in `data`. */
export function state_vector_of(data: Uint8Array): StateVector {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, data);
    return Buffer.from(Y.encodeStateVector(doc)).toString("base64");
  } finally {
    doc.destroy();
  }
}

function decode(sv: string): Map<number, number> {
  if (sv.length === 0 || sv.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(sv)) {
    throw new StateVectorError("malformed state vector");
  }
  let map: Map<number, number>;
  try {
    map = Y.decodeStateVector(Buffer.from(sv, "base64"));
  } catch {
    throw new StateVectorError("undecodable state vector");
  }
  if (Buffer.from(Y.encodeStateVector(map)).toString("base64") !== sv) {
    throw new StateVectorError("non-canonical state vector");
  }
  return map;
}

/** True when `stored` has seen everything `client` has. Throws StateVectorError on malformed input. */
export function covers(stored: StateVector, client: StateVector): boolean {
  const s = decode(stored);
  const c = decode(client);
  for (const [id, clock] of c) {
    if ((s.get(id) ?? 0) < clock) return false;
  }
  return true;
}
