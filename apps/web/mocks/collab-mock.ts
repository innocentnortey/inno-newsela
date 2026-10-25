// Test tool, not a production seam: an in-memory Hocuspocus server that speaks the CON-12 shapes
// (stored / mode / refused stateless messages, cookie check, lock + drop controls) so the editor and
// workspace tickets can be built and tested without apps/collab or Postgres.
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { Server } from "@hocuspocus/server";
import * as decoding from "lib0/decoding";
import * as Y from "yjs";

export interface CollabMock {
  port: number;
  url: string;
  stop(): Promise<void>;
}

export interface CollabMockOptions {
  port?: number;
  debounceMs?: number;
  /** Refuse connections without an `ls_session` cookie (default true). Node WebSocket clients cannot send one. */
  requireCookie?: boolean;
}

const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");

export async function startCollabMock(opts: CollabMockOptions = {}): Promise<CollabMock> {
  const debounce = opts.debounceMs ?? 500;
  const requireCookie = opts.requireCookie ?? true;
  const locked = new Set<string>();
  let lockAll = false;
  const isLocked = (name: string) => lockAll || locked.has(name);

  const server = new Server({
    port: opts.port ?? 4020,
    quiet: true,
    stopOnSignals: false,
    debounce,
    maxDebounce: Math.max(1500, debounce * 3),
    async onConnect({ requestHeaders }) {
      if (!requireCookie) return;
      const cookie = requestHeaders.get("cookie") ?? "";
      if (!/(?:^|;\s*)ls_session=/.test(cookie)) throw new Error("UNAUTHENTICATED");
    },
    async beforeHandleMessage({ connection, document, documentName, update }) {
      if (!isLocked(documentName)) return;
      const dec = decoding.createDecoder(update);
      decoding.readVarString(dec);
      if (decoding.readVarUint(dec) !== 0) return; // not a Sync message
      const step = decoding.readVarUint(dec);
      // y-protocols: 0 = step 1 (state-vector request, passes), 1 = step 2 and 2 = update (both carry changes).
      if (step !== 2 && step !== 1) return;
      const refusedFrom = b64(Y.encodeStateVector(document));
      connection.sendStateless(
        JSON.stringify({
          type: "refused",
          code: "LESSON_LOCKED",
          message: "This lesson is locked. Your last change was not saved.",
          refused_from: refusedFrom,
        }),
      );
      throw new Error("LESSON_LOCKED");
    },
    async onStoreDocument({ document }) {
      // Mock hash: sha256 of the Yjs state, not HP-4's content hash.
      const content_hash = createHash("sha256").update(Y.encodeStateAsUpdate(document)).digest("hex");
      document.broadcastStateless(
        JSON.stringify({
          type: "stored",
          content_hash,
          state_vector: b64(Y.encodeStateVector(document)),
          stored_at: new Date().toISOString(),
        }),
      );
    },
  });

  const delegate = server.requestHandler;
  server.httpServer.removeAllListeners("request");
  server.httpServer.on("request", (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://mock.invalid");
    if (!url.pathname.startsWith("/__mock/")) {
      void delegate(req, res);
      return;
    }
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
    const docs = server.hocuspocus.documents;
    const doc = url.searchParams.get("doc");
    const broadcast = (names: Iterable<string>, msg: object) => {
      for (const n of names) docs.get(n)?.broadcastStateless(JSON.stringify(msg));
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, headers).end();
    } else if (url.pathname === "/__mock/health") {
      res.writeHead(200, headers).end("ok");
    } else if (url.pathname === "/__mock/lock" && req.method === "POST") {
      if (doc) locked.add(doc);
      else lockAll = true;
      broadcast(doc ? [doc] : docs.keys(), { type: "mode", mode: "read_only", state: "submitted" });
      res.writeHead(204, headers).end();
    } else if (url.pathname === "/__mock/unlock" && req.method === "POST") {
      if (doc) locked.delete(doc);
      else {
        locked.clear();
        lockAll = false;
      }
      broadcast(doc ? [doc] : docs.keys(), { type: "mode", mode: "editable", state: "in_review" });
      res.writeHead(204, headers).end();
    } else if (url.pathname === "/__mock/drop" && req.method === "POST") {
      server.hocuspocus.closeConnections();
      res.writeHead(204, headers).end();
    } else {
      res.writeHead(404, headers).end();
    }
  });

  await server.listen();
  const port = server.address.port;
  return { port, url: `ws://localhost:${port}`, stop: () => server.destroy() };
}

const entry = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (entry) {
  const port = Number(process.env.COLLAB_MOCK_PORT ?? 4020);
  void startCollabMock({ port }).then((m) => console.log(`collab mock listening on ${m.url}`));
}
