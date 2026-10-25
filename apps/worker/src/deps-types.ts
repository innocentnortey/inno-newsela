import type { Logger } from "@ls/obs/logger";
import type { WorkerSettings } from "@ls/config/settings";
import type { TxRunner } from "@ls/core/ports/tx";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { Clock } from "@ls/core/ports/clock";
import type { ModelClient } from "@ls/core/ports/model-client";

export type { TxRunner, IdGenerator, Clock, ModelClient };

export interface WorkerDeps {
  settings: WorkerSettings;
  logger: Logger;
  db: TxRunner;
  ids: IdGenerator;
  clock: Clock;
  model_client: ModelClient;
}
