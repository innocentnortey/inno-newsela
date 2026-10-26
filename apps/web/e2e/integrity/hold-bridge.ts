// NL-125: the con-12 bridge (page /collab socket piped to the real collab process with the context's session cookie) with
// one extra: while `hold.on` is true, frames from the server to the page are queued, then delivered in order by release().
// This models a page that has not yet heard about the lock (network lag), so a real keystroke can land after the freeze.
import type { Page } from "@playwright/test";
import { cookieHeader, sessionToken } from "../integration/con-12/helpers";

export interface Hold {
  on: boolean;
  /** Deliver the queued frames and stop holding. */
  release(): void;
}

export async function bridgeHeld(page: Page, port: number): Promise<Hold> {
  const cookie = cookieHeader(await sessionToken(page.context()));
  const queue: (() => void)[] = [];
  const hold: Hold = {
    on: false,
    release() {
      hold.on = false;
      for (const send of queue.splice(0)) send();
    },
  };
  await page.routeWebSocket(/\/collab/, (ws) => {
    const upstream = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { cookie } } as never);
    upstream.binaryType = "arraybuffer";
    const pending: (string | Buffer)[] = [];
    let open = false;
    upstream.addEventListener("open", () => {
      open = true;
      for (const m of pending.splice(0)) upstream.send(m as never);
    });
    ws.onMessage((m) => (open ? upstream.send(m as never) : void pending.push(m)));
    upstream.addEventListener("message", (e) => {
      const d = e.data as string | ArrayBuffer;
      const send = () => ws.send(typeof d === "string" ? d : Buffer.from(d));
      if (hold.on) queue.push(send);
      else send();
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
  return hold;
}
