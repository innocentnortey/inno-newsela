// Shell (NL-105 fills). Refuses every /internal request; never reads the Authorization header.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Logger } from "@ls/obs/logger";

export const NOT_BUILT_EVENT = "internal.not_built";

export function is_internal_path(url: string | undefined): boolean {
  const path = (url ?? "").split("?")[0] ?? "";
  return path === "/internal" || path.startsWith("/internal/");
}

export function handle_internal(req: IncomingMessage, res: ServerResponse, logger: Logger): void {
  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: { code: "COLLAB_UNAVAILABLE", message: "The collaboration commands are not available yet", details: {} },
    }),
  );
  logger.warn(NOT_BUILT_EVENT, { extra: { method: req.method ?? "", path_prefix: "/internal" } });
}
