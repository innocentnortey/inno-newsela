// NL-101 support (implementer): a bridge like bridge.ts whose link can be cut and restored, or made one-way,
// to model an outage (page.routeWebSocket is not affected by context.setOffline, so the link is cut here instead).
import type { Page } from "@playwright/test";
import { cookieHeader, sessionToken } from "./helpers";

export interface Gate {
  /** true: open sockets are closed and new ones refused. */
  blocked: boolean;
  /** true: page-to-server messages are dropped (edits stay unsaved), server-to-page still flows. */
  dropUp: boolean;
  opened: number;
  closeAll(): void;
}

export function newGate(): Gate {
  const live = new Set<() => void>();
  const g: Gate & { _live: Set<() => void> } = {
    blocked: false,
    dropUp: false,
    opened: 0,
    _live: live,
    closeAll: () => {
      for (const c of [...live]) c();
    },
  };
  return g;
}

export async function gatedBridge(page: Page, port: number, gate: Gate): Promise<void> {
  const cookie = cookieHeader(await sessionToken(page.context()));
  const live = (gate as unknown as { _live: Set<() => void> })._live;
  await page.routeWebSocket(/\/collab/, (ws) => {
    if (gate.blocked) {
      void ws.close().catch(() => {});
      return;
    }
    gate.opened += 1;
    const upstream = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { cookie } } as never);
    upstream.binaryType = "arraybuffer";
    const pending: (string | Buffer)[] = [];
    let open = false;
    const shut = () => {
      live.delete(shut);
      try {
        upstream.close();
      } catch {
        /* already closed */
      }
      void ws.close().catch(() => {});
    };
    live.add(shut);
    upstream.addEventListener("open", () => {
      open = true;
      for (const m of pending.splice(0)) upstream.send(m as never);
    });
    ws.onMessage((m) => {
      if (gate.dropUp) return;
      if (open) upstream.send(m as never);
      else pending.push(m);
    });
    upstream.addEventListener("message", (e) => {
      const d = e.data as string | ArrayBuffer;
      ws.send(typeof d === "string" ? d : Buffer.from(d));
    });
    upstream.addEventListener("close", () => void shut());
    upstream.addEventListener("error", () => void shut());
    ws.onClose(() => void shut());
  });
}
