import { DomainRefusal } from "@ls/core/errors";
import type { ImportLinkRequest } from "@ls/schema/api/outlines";
import type { HttpRequest, HttpResponse, JsonValue, RouteHandler, make_with_route } from "../../../src/server/http/with-route.ts";
import type { OutlineService } from "../../../src/server/services/outline-service.ts";

export const UPLOAD_ENVELOPE_BYTES = 1_048_576; // multipart overhead allowance on top of OUTLINE_MAX_BYTES
const JSON_BODY_CAP = 8192;

async function read_capped(body: ReadableStream<Uint8Array> | null, cap: number): Promise<Uint8Array | null> {
  if (body === null) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

function parse_cookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const raw = part.slice(i + 1).trim();
    if (k === "") continue;
    try {
      out[k] = decodeURIComponent(raw);
    } catch {
      out[k] = raw;
    }
  }
  return out;
}

async function multipart_body(req: Request, max_file_bytes: number): Promise<JsonValue> {
  const cap = max_file_bytes + UPLOAD_ENVELOPE_BYTES;
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > cap) return { reject: "too_large", file: null };
  const bytes = await read_capped(req.body, cap);
  if (bytes === null) return { reject: "too_large", file: null };
  let form: FormData;
  try {
    form = await new Response(bytes as BodyInit, { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData();
  } catch {
    return { reject: "type", file: null };
  }
  const f = form.get("file");
  if (f === null || typeof f === "string") return { reject: "type", file: null };
  if (f.size > max_file_bytes) return { reject: "too_large", file: null };
  return {
    reject: null,
    file: { filename: f.name, content_type: f.type, data_base64: Buffer.from(await f.arrayBuffer()).toString("base64") },
  };
}

export async function to_http_request(req: Request, opts: { multipart: boolean; max_file_bytes: number }): Promise<HttpRequest> {
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  const query: Record<string, string | string[]> = {};
  for (const [k, v] of new URL(req.url).searchParams) {
    const cur = query[k];
    query[k] = cur === undefined ? v : Array.isArray(cur) ? [...cur, v] : [cur, v];
  }
  let body: JsonValue | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (opts.multipart) body = await multipart_body(req, opts.max_file_bytes);
    else {
      const bytes = await read_capped(req.body, JSON_BODY_CAP);
      if (bytes !== null && bytes.length > 0) {
        try {
          body = JSON.parse(new TextDecoder().decode(bytes)) as JsonValue;
        } catch {
          body = null;
        }
      }
    }
  }
  return { method: req.method, path_params: {}, query, headers, body, cookies: parse_cookies(headers["cookie"]) };
}

export function to_response(res: HttpResponse): Response {
  return new Response(res.body === null ? null : JSON.stringify(res.body), { status: res.status, headers: res.headers });
}

export interface OutlineHandlers {
  list_units: RouteHandler;
  upload: RouteHandler;
  import_link: RouteHandler;
}

const FILE_MESSAGE = "That file is not a CSV or XLSX outline within the size limit.";

function upload_args(body: JsonValue | null): { filename: string; content_type: string; data: Uint8Array } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new DomainRefusal("INVALID_REQUEST", "The request is not valid.", { fields: ["body"] });
  }
  if (body["reject"] === "too_large") throw new DomainRefusal("UNSUPPORTED_FILE", FILE_MESSAGE, { reason: "too_large" });
  const f = body["file"];
  if (body["reject"] === "type" || f === null || f === undefined || typeof f !== "object" || Array.isArray(f)) {
    throw new DomainRefusal("UNSUPPORTED_FILE", FILE_MESSAGE, { reason: "type" });
  }
  const { filename, content_type, data_base64 } = f;
  if (typeof filename !== "string" || typeof content_type !== "string" || typeof data_base64 !== "string") {
    throw new DomainRefusal("UNSUPPORTED_FILE", FILE_MESSAGE, { reason: "type" });
  }
  return { filename, content_type, data: new Uint8Array(Buffer.from(data_base64, "base64")) };
}

export function make_outline_handlers(deps: {
  with_route: ReturnType<typeof make_with_route>;
  outlines: () => OutlineService;
}): OutlineHandlers {
  const { with_route, outlines } = deps;
  return {
    list_units: with_route(async (user) => (await outlines().list_units(user)) as unknown as JsonValue, {
      operation_id: "listUnits",
      roles: ["author", "reviewer", "approver"],
      request_schema: null,
      success_status: 200,
    }),
    upload: with_route(
      async (user, request) => (await outlines().upload(user, upload_args(request.body), null)) as unknown as JsonValue,
      { operation_id: "uploadOutline", roles: ["author"], request_schema: null, success_status: 201 },
    ),
    import_link: with_route(
      async (user, request) => (await outlines().import_link(user, request.body as ImportLinkRequest)) as unknown as JsonValue,
      { operation_id: "importOutlineLink", roles: ["author"], request_schema: "ImportLinkRequest", success_status: 201 },
    ),
  };
}
