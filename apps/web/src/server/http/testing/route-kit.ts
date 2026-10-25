// NL-25 frozen route-test kit (synthetic only): request builder + cookie parsing. Hashed in the NL-25 manifest.
import { ORIGIN } from "./session-harness.ts";

export const URL_SESSION = `${ORIGIN}/api/session`;
export function req(method: "POST" | "GET" | "DELETE", opts: { body?: unknown; origin?: string | null; cookie?: string } = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const origin = opts.origin === undefined ? ORIGIN : opts.origin;
  if (origin !== null) headers["origin"] = origin;
  if (opts.cookie !== undefined) headers["cookie"] = opts.cookie;
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  return new Request(URL_SESSION, init);
}
export const set_cookie = (res: Response): string => res.headers.get("set-cookie") ?? "";
export const token_of = (res: Response): string => /ls_session=([^;]+)/.exec(set_cookie(res))?.[1] ?? "";
export const code_of = async (res: Response): Promise<string> => ((await res.json()) as { error: { code: string } }).error.code;
