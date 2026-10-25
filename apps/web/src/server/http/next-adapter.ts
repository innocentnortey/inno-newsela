// Next Request <-> HttpRequest/HttpResponse adapter (shared by every /api route). Pure; no service imports.
import { RequestId } from "@ls/schema/ids";
import { mint_request_id, type HttpRequest, type HttpResponse, type JsonValue } from "./with-route.ts";

function parse_cookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (header === null) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (name === "") continue;
    const raw = part.slice(i + 1).trim();
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  return out;
}

export async function to_http_request(req: Request, path_params: Record<string, string> = {}): Promise<HttpRequest> {
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  // One request id for both with_route and the handler.
  const rid = headers["x-request-id"];
  if (rid === undefined || !RequestId.safeParse(rid).success) headers["x-request-id"] = mint_request_id();
  const query: Record<string, string | string[]> = {};
  new URL(req.url).searchParams.forEach((v, k) => {
    const prev = query[k];
    query[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  });
  let body: JsonValue | null = null;
  const text = await req.text();
  if (text !== "") {
    try {
      body = JSON.parse(text) as JsonValue;
    } catch {
      body = null; // the schema step answers INVALID_REQUEST
    }
  }
  return { method: req.method, path_params, query, headers, body, cookies: parse_cookies(headers["cookie"] ?? null) };
}

export function to_response(r: HttpResponse, extra_headers: Record<string, string | string[]> = {}): Response {
  const headers = new Headers();
  for (const [k, v] of Object.entries(r.headers)) headers.set(k, v);
  for (const [k, v] of Object.entries(extra_headers)) {
    if (Array.isArray(v)) for (const x of v) headers.append(k, x);
    else headers.set(k, v);
  }
  if (r.status === 204 || r.body === null) {
    headers.delete("Content-Type");
    return new Response(null, { status: r.status, headers });
  }
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(r.body), { status: r.status, headers });
}
