// NL-51: GET downloadExport.
import { export_handlers } from "../../default.ts";
import { to_http_request, to_response } from "@/server/http/next-adapter.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ exportId: string }> }): Promise<Response> {
  return to_response(await export_handlers.download_export(await to_http_request(request, await ctx.params)));
}
