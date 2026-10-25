// Shell for WF-39. No DB check (NL-83).
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export interface HealthServer { readonly port: number; close(): Promise<void> }

export function serve_health(port: number): Promise<HealthServer> {
  const server = createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0];
    res.setHeader("Content-Type", "application/json");
    if (path === "/healthz" && (req.method === "GET" || req.method === "HEAD")) {
      res.writeHead(200).end(JSON.stringify({ status: "ok" }));
    } else {
      res.writeHead(404).end(JSON.stringify({ error: { code: "NOT_FOUND", message: "No such route", details: {} } }));
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      const bound = (server.address() as AddressInfo).port;
      resolve({
        port: bound,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
            server.closeAllConnections();
          }),
      });
    });
  });
}
