import {
  read_json_body,
  to_http_request,
  to_response,
} from "@/server/routes/slot-fill-routes";
import { slot_fill_handlers } from "@/server/routes/slot-fill-default";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ lessonId: string; slotId: string }> },
): Promise<Response> {
  const body = await read_json_body(request);
  return to_response(
    await slot_fill_handlers.fill_slot(
      to_http_request(request, await ctx.params, body),
    ),
  );
}
