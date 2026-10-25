import type { WebSettings } from "@ls/config/settings";
import type { Logger } from "@ls/obs/logger";
import type { Clock, IdGenerator, ModelClient, PgDatabase } from "./deps-types.ts";

export interface WebDeps {
  settings: WebSettings;
  logger: Logger;
  db: PgDatabase;
  ids: IdGenerator;
  clock: Clock;
  model_client: ModelClient;
}
