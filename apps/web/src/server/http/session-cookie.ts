// Pure Set-Cookie string builders for the session cookie (NL-25). The token is base64url: cookie-safe.
function attrs(app_origin: string): string {
  const host = new URL(app_origin).hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  return `HttpOnly; SameSite=Strict; Path=/${local ? "" : "; Secure"}`;
}

export function build_set_cookie(name: string, token: string, max_age_s: number, app_origin: string): string {
  return `${name}=${token}; ${attrs(app_origin)}; Max-Age=${max_age_s}`;
}

export function build_clear_cookie(name: string, app_origin: string): string {
  return `${name}=; ${attrs(app_origin)}; Max-Age=0`;
}
