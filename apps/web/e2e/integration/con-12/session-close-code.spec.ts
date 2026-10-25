// NL-101 (S-9): the socket closed by the session re-check carries the session-ended reason.
// Hocuspocus' graceful Connection.close() sends 4401 in its own close message and ends the transport with code 1000,
// so the reason string is the observable marker at the websocket level.
// The frozen unauthenticated-refused spec asserts the close; this adds the code (frozen files are not edited).
import { HocuspocusProvider } from "@hocuspocus/provider";
import { expect, test } from "@playwright/test";
import * as Y from "yjs";
import { cookieHeader, sessionToken, signedInContext, startCollab } from "./helpers";
import { closeSeedPool, seedLesson } from "./seed";

test.afterAll(closeSeedPool);

test("session-close-code: signing out closes the open socket with the session-ended reason (not an auth failure) [negative]", async ({ browser }) => {
  const lesson = await seedLesson("in_review");
  const collab = await startCollab();
  const { context, page } = await signedInContext(browser, "reviewer");
  const cookie = cookieHeader(await sessionToken(context));
  const closes: { code: number; reason: string }[] = [];
  class SpyWS extends WebSocket {
    constructor(u: string | URL) {
      super(u, { headers: { cookie } } as never);
    }
  }
  let synced = false;
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:${collab.port}`,
    name: `lesson:${lesson.lessonId}`,
    token: "cookie",
    document: new Y.Doc(),
    WebSocketPolyfill: SpyWS,
    onSynced: () => void (synced = true),
    onClose: ({ event }: { event: { code: number; reason: string } }) => void closes.push({ code: event.code, reason: event.reason }),
  } as never);
  try {
    await expect.poll(() => synced, { timeout: 8000 }).toBe(true);
    const status = await page.evaluate(async () => (await fetch("/api/session", { method: "DELETE" })).status);
    expect(status).toBe(204);
    await expect.poll(() => closes.length, { timeout: 5000 }).toBeGreaterThan(0);
    expect(closes[0]!.reason).toBe("Session ended. Sign in again.");
  } finally {
    provider.destroy();
    await context.close();
    await collab.close();
  }
});
