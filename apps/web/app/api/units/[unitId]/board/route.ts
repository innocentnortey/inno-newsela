// NL-54: GET get_board.
import { board_handlers } from "@/server/routes/board-default.ts";
import { to_http_request, to_response } from "@/server/http/next-adapter.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ unitId: string }> }): Promise<Response> {
  return to_response(await board_handlers.get_board(await to_http_request(request, await ctx.params)));
}
