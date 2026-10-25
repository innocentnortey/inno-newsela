// /api/session: POST signIn, GET getSession, DELETE signOut (CON-1). Thin: logic is in SessionService.
import type { SignInRequest } from "@ls/schema/api/session";
import { load_web_settings, type WebSettings } from "@ls/config/settings";
import { getServices } from "../../../src/server/container.ts";
import { to_http_request, to_response } from "../../../src/server/http/next-adapter.ts";
import { build_clear_cookie, build_set_cookie } from "../../../src/server/http/session-cookie.ts";
import { with_route, type JsonValue } from "../../../src/server/http/with-route.ts";
import type { SignInOutcome } from "../../../src/server/services/session-service.ts";

let cached: WebSettings | undefined;
const settings = (): WebSettings => (cached ??= load_web_settings(process.env));
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  let outcome: SignInOutcome | undefined;
  const handler = with_route(
    async (_user, req) => {
      outcome = await getServices().sessions.sign_in(req.body as unknown as SignInRequest, {
        request_id: req.headers["x-request-id"]!,
        ip_hash: null,
      });
      return outcome.session as unknown as JsonValue;
    },
    { operation_id: "signIn", public: true, request_schema: "SignInRequest", success_status: 200 },
  );
  const res = await handler(await to_http_request(request));
  const extra: Record<string, string | string[]> = { ...NO_STORE };
  if (res.status === 200 && outcome !== undefined) {
    const s = settings();
    extra["Set-Cookie"] = build_set_cookie(s.session_cookie_name, outcome.cookie_token, s.session_ttl_hours * 3600, s.app_origin);
  }
  return to_response(res, extra);
}

export async function GET(request: Request): Promise<Response> {
  const handler = with_route((user) => getServices().sessions.get_session(user) as unknown as Promise<JsonValue>, {
    operation_id: "getSession",
    roles: null,
    request_schema: null,
    success_status: 200,
  });
  return to_response(await handler(await to_http_request(request)), NO_STORE);
}

export async function DELETE(request: Request): Promise<Response> {
  const s = settings();
  const handler = with_route(
    async (user, req) => {
      await getServices().sessions.sign_out(user, req.cookies[s.session_cookie_name] ?? "");
      return null;
    },
    { operation_id: "signOut", roles: null, request_schema: null, success_status: 204 },
  );
  const res = await handler(await to_http_request(request));
  const extra: Record<string, string | string[]> = { ...NO_STORE };
  if (res.status === 204) extra["Set-Cookie"] = build_clear_cookie(s.session_cookie_name, s.app_origin);
  return to_response(res, extra);
}
