// NL-93 checkpoint 2: a loopback node:http server standing in for Google Sheets. The web process was started with
// SHEETS_BASE_URL = E2E_SHEETS_BASE_URL, so this server must listen on exactly that port.
import { createServer, type Server } from "node:http";
import type { Socket } from "node:net";
import { readFileSync } from "node:fs";
import { ISSUED_XLSX, XLSX_MIME } from "./files";

export interface SheetsServer {
  url: string;
  sheetUrl(id: string): string;
  hits(id: string): number;
  resetHits(): void;
  close(): Promise<void>;
}
export const PUBLIC_ID = "PUBLICissuedSheet01"; // serves the issued unit as XLSX
export const PRIVATE_ID = "PRIVATEsheet0000001"; // serves a text/html sign-in page (200)
export const STALL_ID = "STALLEDsheet000000001"; // never answers

export async function startSheetsServer(): Promise<SheetsServer> {
  const base = process.env.E2E_SHEETS_BASE_URL;
  if (!base) throw new Error("export E2E_SHEETS_BASE_URL=http://127.0.0.1:<port> before the run");
  const port = Number(new URL(base).port);
  const xlsx = readFileSync(ISSUED_XLSX);
  const hits = new Map<string, number>();
  const sockets = new Set<Socket>();
  const server: Server = createServer((req, res) => {
    const m = /^\/spreadsheets\/d\/([A-Za-z0-9_-]+)\/export\?format=xlsx$/.exec(req.url ?? "");
    if (req.method !== "GET" || m === null) {
      res.writeHead(404).end();
      return;
    }
    const id = m[1] as string;
    hits.set(id, (hits.get(id) ?? 0) + 1);
    if (id === PUBLIC_ID) {
      res.writeHead(200, { "content-type": XLSX_MIME, "content-length": xlsx.length }).end(xlsx);
    } else if (id === PRIVATE_ID) {
      const body = "<html><title>Sign in</title><body>Sign in to continue</body></html>";
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-length": Buffer.byteLength(body) }).end(body);
    } else if (id === STALL_ID) {
      // keep the socket open and send nothing
    } else {
      res.writeHead(404).end();
    }
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => ok());
  });
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    sheetUrl: (id) => `${url}/spreadsheets/d/${id}/edit`,
    hits: (id) => hits.get(id) ?? 0,
    resetHits: () => hits.clear(),
    close: () =>
      new Promise<void>((ok) => {
        for (const s of sockets) s.destroy();
        server.close(() => ok());
      }),
  };
}
