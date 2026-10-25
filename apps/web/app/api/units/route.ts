import { load_web_settings } from "@ls/config/settings";
import { getServices } from "../../../src/server/container.ts";
import { with_route } from "../../../src/server/http/with-route.ts";
import { make_outline_handlers, to_http_request, to_response } from "../outline-versions/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = make_outline_handlers({ with_route, outlines: () => getServices().outlines });

export async function GET(request: Request): Promise<Response> {
  const settings = load_web_settings(process.env);
  return to_response(await handlers.list_units(await to_http_request(request, { multipart: false, max_file_bytes: settings.outline_max_bytes })));
}
