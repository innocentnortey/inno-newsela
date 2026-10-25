// NL-34 GET (listPromptVersions), NL-88 POST (saveGuidance). This file exports GET and POST and nothing else;
// no path here reaches the locked layer.
import { getServices } from "@/server/container.ts";
import { make_post } from "@/server/services/run-start-route.ts";
import { with_route, type HttpRequest, type JsonValue } from "@/server/http/with-route.ts";
import type { SaveGuidanceRequest } from "@ls/schema/api/prompts";

const handler = with_route(
  async (user) => (await getServices().prompts.list(user)) as unknown as JsonValue,
  { operation_id: "listPromptVersions", roles: null, request_schema: null, success_status: 200 },
);

function to_http_request(request: Request): HttpRequest {
  const url = new URL(request.url);
  const query: Record<string, string | string[]> = {};
  for (const [k, v] of url.searchParams.entries()) {
    const prev = query[k];
    query[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  const cookies: Record<string, string> = {};
  for (const part of (headers["cookie"] ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    const raw = part.slice(i + 1).trim();
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  }
  return { method: request.method, path_params: {}, query, headers, body: null, cookies };
}

export async function GET(request: Request): Promise<Response> {
  const res = await handler(to_http_request(request));
  return new Response(JSON.stringify(res.body), { status: res.status, headers: res.headers });
}

// The OpenAPI saveGuidance response is 201 (the plan guessed 200); the contract wins.
const save_handler = with_route(
  async (user, request) => (await getServices().prompts.save_guidance(user, request.body as unknown as SaveGuidanceRequest)) as unknown as JsonValue,
  { operation_id: "saveGuidance", roles: ["author"], request_schema: "SaveGuidanceRequest", success_status: 201 },
);
export const POST = make_post(save_handler);
