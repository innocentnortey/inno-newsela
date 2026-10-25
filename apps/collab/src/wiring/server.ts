// Shell. Filled by NL-80.
import type { CollabDeps } from "../deps-types.ts";

export const FILLER = "NL-80" as const;
export type HocuspocusServerRef = { readonly hocuspocus: unknown };
export type CollabServerWiring = Record<string, never>;
export function wire_collab_server(_d: CollabDeps, _h: HocuspocusServerRef): CollabServerWiring {
  return {};
}
