// Shell. Filled by NL-105.
import type { CollabDeps } from "../deps-types.ts";
import type { CollabServerWiring, HocuspocusServerRef } from "./server.ts";

export const FILLER = "NL-105" as const;
export type CollabCommandWiring = Record<string, never>;
export function wire_collab_commands(_d: CollabDeps, _s: CollabServerWiring, _h: HocuspocusServerRef): CollabCommandWiring {
  return {};
}
