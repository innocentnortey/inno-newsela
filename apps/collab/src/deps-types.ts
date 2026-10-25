import type { Logger } from "@ls/obs/logger";
import type { CollabSettings } from "@ls/config/settings";
import type { TxRunner } from "@ls/core/ports/tx";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { Clock } from "@ls/core/ports/clock";

export type { TxRunner, IdGenerator, Clock };

export interface CollabDeps {
  settings: CollabSettings;
  logger: Logger;
  db: TxRunner;
  ids: IdGenerator;
  clock: Clock;
}
