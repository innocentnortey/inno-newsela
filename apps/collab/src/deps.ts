import type { Logger } from "@ls/obs/logger";
import type { CollabSettings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { CollabDeps } from "./deps-types.ts";

// Stub for a dependency whose adapter is not built yet: any use fails loudly with the owning ticket.
function unbuilt<T extends object>(owner: string): T {
  return new Proxy({} as T, {
    get: () => () => {
      throw new Error("NOT BUILT: " + owner);
    },
  });
}

export function build_collab_deps(settings: CollabSettings, logger: Logger): CollabDeps {
  return {
    settings,
    logger,
    db: unbuilt("NL-36"),
    ids: new PrefixedIdGenerator(),
    clock: new SystemClock(),
  };
}
