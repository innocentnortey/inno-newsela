// CON-15 fillSlot route: handler factory plus the Next bridge helpers (own copies; one shared bridge is a later refactor).
import { z } from "zod";
import type { LessonId } from "@ls/core/ports/common";
import { LessonId as LessonIdSchema } from "@ls/schema/ids";
import type { FillSlotRequest } from "@ls/schema/api/lessons";
import type {
  HttpRequest,
  HttpResponse,
  JsonValue,
  RouteHandler,
  make_with_route,
} from "../http/with-route.ts";
import type { SlotApi } from "../services/slot-service.ts";

const SlotFillParams = z.object({
  lessonId: LessonIdSchema,
  slotId: z.string().min(1).max(200),
});

export function make_slot_fill_handlers(d: {
  with_route: ReturnType<typeof make_with_route>;
  slots: () => SlotApi;
}): { fill_slot: RouteHandler } {
  return {
    fill_slot: d.with_route(
      (user, req) =>
        d
          .slots()
          .fill(
            user,
            req.path_params["lessonId"] as LessonId,
            req.path_params["slotId"] as string,
            req.body as FillSlotRequest,
          ) as unknown as Promise<JsonValue>,
      {
        operation_id: "fillSlot",
        roles: ["reviewer"],
        request_schema: "FillSlotRequest",
        success_status: 200,
        params_schema: SlotFillParams,
      },
    ),
  };
}

function safe_decode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function parse_cookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (header === undefined) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (name !== "") out[name] = part.slice(i + 1).trim();
  }
  return out;
}

export function to_http_request(
  req: Request,
  params: { lessonId: string; slotId: string },
  body: unknown,
): HttpRequest {
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  const query: Record<string, string | string[]> = {};
  for (const [k, v] of new URL(req.url).searchParams.entries()) {
    const prev = query[k];
    query[k] =
      prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return {
    method: req.method,
    path_params: {
      lessonId: safe_decode(params.lessonId),
      slotId: safe_decode(params.slotId),
    },
    query,
    headers,
    cookies: parse_cookies(headers["cookie"]),
    body: body as JsonValue | null,
  };
}

export function to_response(res: HttpResponse): Response {
  return new Response(JSON.stringify(res.body), {
    status: res.status,
    headers: res.headers,
  });
}

export async function read_json_body(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null; // with_route answers INVALID_REQUEST
  }
}
