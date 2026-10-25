// Local structural types (same reason as NL-06 section 4). NL-12 re-points db/ids/clock/model_client at the real ports.
import type { Logger } from "@ls/obs/logger";
import type { WorkerSettings } from "@ls/config/settings";

export interface DbHandle { readonly kind: "unwired" }
export interface IdGenerator { next(prefix: string): string }
export interface Clock { now(): Date }
export interface ModelClientHandle { readonly kind: "unwired" }
export interface WorkerDeps {
  settings: WorkerSettings;
  logger: Logger;
  db: DbHandle;
  ids: IdGenerator;
  clock: Clock;
  model_client: ModelClientHandle;
}
