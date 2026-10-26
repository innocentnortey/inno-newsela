import type { Logger } from "@ls/obs/logger";
import type { CollabSettings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { CollabDeps } from "./deps-types.ts";

export function build_collab_deps(settings: CollabSettings, logger: Logger): CollabDeps {
  return {
    settings,
    logger,
    ids: new PrefixedIdGenerator(),
    clock: new SystemClock(),
  };
}
