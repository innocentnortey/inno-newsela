import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, isApiError, setUnauthenticatedHandler } from "@/lib/api-client";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const env = (code: string, details?: Record<string, unknown>) => ({ error: { code, message: `msg ${code}`, details } });

function clientWith(res: () => Response | Promise<Response>) {
  return createApiClient({ baseUrl: "http://t.test/api", fetch: (async () => res()) as unknown as typeof fetch });
}
async function caught(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    if (isApiError(e)) return e;
    throw e;
  }
  throw new Error("did not throw");
}

afterEach(() => setUnauthenticatedHandler(null));

describe("api client errors", () => {
  const cases: Array<[number, string]> = [
    [400, "INVALID_REQUEST"],
    [401, "UNAUTHENTICATED"],
    [403, "ROLE_FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "STALE_PIN"],
    [422, "INVALID_CHOICE"],
    [500, "SERVICE_BUSY"],
    [502, "SHEET_UNREACHABLE"],
    [503, "COLLAB_UNAVAILABLE"],
  ];
  for (const [status, code] of cases) {
    it(`${status} becomes ApiError ${code}`, async () => {
      const api = clientWith(() => json(status, env(code, { k: 1 }), { "x-request-id": "req-1" }));
      const e = await caught(api.GET("/session"));
      expect(e).toMatchObject({ status, code, message: `msg ${code}`, details: { k: 1 }, requestId: "req-1" });
    });
  }

  it("HTML error body becomes NETWORK with the status", async () => {
    const api = clientWith(() => new Response("<html>bad gateway</html>", { status: 502, headers: { "content-type": "text/html" } }));
    expect(await caught(api.GET("/session"))).toMatchObject({ code: "NETWORK", status: 502, details: {}, requestId: null });
  });

  it("a rejected fetch becomes NETWORK with status 0", async () => {
    const api = createApiClient({ baseUrl: "http://t.test/api", fetch: (async () => { throw new TypeError("offline"); }) as unknown as typeof fetch });
    expect(await caught(api.GET("/session"))).toMatchObject({ code: "NETWORK", status: 0 });
  });

  it("a 2xx with a non-JSON body is NETWORK", async () => {
    const api = clientWith(() => new Response("hi", { status: 200, headers: { "content-type": "text/plain" } }));
    expect(await caught(api.GET("/session"))).toMatchObject({ code: "NETWORK", status: 200 });
  });

  it("returns data for a 200", async () => {
    const session = { user: { user_id: "u1", name: "A", email: "a@example.org", role: "author", synthetic: false }, expires_at: "2026-10-26T03:00:00Z" };
    const api = clientWith(() => json(200, session));
    expect((await api.GET("/session")).data).toEqual(session);
  });

  it("calls the unauthenticated handler once for UNAUTHENTICATED only", async () => {
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    await caught(clientWith(() => json(401, env("UNAUTHENTICATED"))).GET("/session"));
    expect(handler).toHaveBeenCalledTimes(1);
    await caught(clientWith(() => json(403, env("ROLE_FORBIDDEN"))).GET("/session"));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
