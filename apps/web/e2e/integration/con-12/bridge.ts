// NL-101 support (test-writer): the page's /collab websocket is piped to the in-process collab server with the
// context's session cookie. Next serves no /collab route and NEXT_PUBLIC_COLLAB_URL is a build-time value (plan 4).
import type { Page } from "@playwright/test";
import { cookieHeader, sessionToken } from "./helpers";

export async function bridgeCollab(page: Page, port: number, opts: { delayMs?: number } = {}): Promise<void> {
  const cookie = cookieHeader(await sessionToken(page.context()));
  await page.routeWebSocket(/\/collab/, (ws) => {
    const upstream = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { cookie } } as never);
    upstream.binaryType = "arraybuffer";
    const pending: (string | Buffer)[] = [];
    let open = false;
    upstream.addEventListener("open", () => {
      const go = () => {
        open = true;
        for (const m of pending.splice(0)) upstream.send(m as never);
      };
      if (opts.delayMs) setTimeout(go, opts.delayMs);
      else go();
    });
    ws.onMessage((m) => (open ? upstream.send(m as never) : void pending.push(m)));
    upstream.addEventListener("message", (e) => {
      const d = e.data as string | ArrayBuffer;
      ws.send(typeof d === "string" ? d : Buffer.from(d));
    });
    upstream.addEventListener("close", () => void ws.close().catch(() => {}));
    upstream.addEventListener("error", () => void ws.close().catch(() => {}));
    ws.onClose(() => {
      try {
        upstream.close();
      } catch {
        /* already closed */
      }
    });
  });
}
