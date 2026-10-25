// NL-101 support (test-writer): a Hocuspocus provider without a browser, optionally carrying a session cookie.
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";

export interface RawClient {
  doc: Y.Doc;
  /** Stateless messages from the server, parsed (stored / refused / mode). */
  messages: Record<string, unknown>[];
  synced(): boolean;
  /** Set when the server refused authentication. */
  authFailed(): boolean;
  closed(): boolean;
  /** A write: sets front_matter.title. */
  edit(text: string): void;
  title(): unknown;
  until(cond: () => boolean, ms: number, what: string): Promise<void>;
  ofType(type: string): Record<string, unknown>[];
  destroy(): void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function connectRaw(port: number, lessonId: string, cookie: string | null): RawClient {
  class CookieWS extends WebSocket {
    constructor(u: string | URL) {
      super(u, (cookie ? { headers: { cookie } } : {}) as never);
    }
  }
  const doc = new Y.Doc();
  const messages: Record<string, unknown>[] = [];
  let synced = false;
  let authFailed = false;
  let closed = false;
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:${port}`,
    name: `lesson:${lessonId}`,
    token: "cookie",
    document: doc,
    WebSocketPolyfill: CookieWS,
    onSynced: () => void (synced = true),
    onAuthenticationFailed: () => void (authFailed = true),
    onClose: () => void (closed = true),
    onStateless: ({ payload }: { payload: string }) => {
      try {
        messages.push(JSON.parse(payload));
      } catch {
        /* ignore */
      }
    },
  } as never);
  const until = async (cond: () => boolean, ms: number, what: string) => {
    const end = Date.now() + ms;
    while (!cond()) {
      if (Date.now() > end) throw new Error(`timeout waiting for ${what}`);
      await sleep(25);
    }
  };
  return {
    doc,
    messages,
    synced: () => synced,
    authFailed: () => authFailed,
    closed: () => closed,
    edit: (text) => doc.getMap("front_matter").set("title", text),
    title: () => doc.getMap("front_matter").get("title"),
    until,
    ofType: (t) => messages.filter((m) => m.type === t),
    destroy: () => provider.destroy(),
  };
}
