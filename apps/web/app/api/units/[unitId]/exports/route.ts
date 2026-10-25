// NL-51: GET listExports, POST createExport.
import { export_handlers } from "../../../exports/default.ts";
import { to_http_request, to_response } from "@/server/http/next-adapter.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ unitId: string }> }): Promise<Response> {
  return to_response(await export_handlers.list_exports(await to_http_request(request, await ctx.params)));
}

export async function POST(request: Request, ctx: { params: Promise<{ unitId: string }> }): Promise<Response> {
  return to_response(await export_handlers.create_export(await to_http_request(request, await ctx.params)));
}
