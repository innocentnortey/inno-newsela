// Shell for WF-39. No DB check (NL-83).
import type { ServerResponse } from "node:http";

export function is_health_path(url: string | undefined, method?: string): boolean {
  const path = (url ?? "").split("?")[0];
  return path === "/healthz" && (method === undefined || method === "GET" || method === "HEAD");
}

export function handle_healthz(res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
}
