// Local structural types (same reason as NL-06 section 4). NL-12 re-points db/ids/clock at the real ports.
import type { Logger } from "@ls/obs/logger";
import type { CollabSettings } from "@ls/config/settings";

export interface DbHandle { readonly kind: "unwired" }
export interface IdGenerator { next(prefix: string): string }
export interface Clock { now(): Date }
export interface CollabDeps {
  settings: CollabSettings;
  logger: Logger;
  db: DbHandle;
  ids: IdGenerator;
  clock: Clock;
}
