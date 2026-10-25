// GET /api/healthz for web (WF-39). Open, liveness only: no session, no with_route.
import { web_health } from "../../../src/server/health.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const r = await web_health()(request.headers.get("x-request-id") ?? undefined);
  return new Response(JSON.stringify(r.body), {
    status: r.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": r.request_id },
  });
}
