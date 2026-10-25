// Redirects page requests without a session cookie to /sign-in. Presence check only: the API validates the session.
// (Next 16 prefers the name proxy.ts; middleware.ts still works and the ticket fixes this path.)
import { NextResponse, type NextRequest } from "next/server";

const OPEN = /^\/(sign-in|api|_next|healthz|favicon\.ico)(\/|$)/;

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (OPEN.test(pathname) || /\.[^/]+$/.test(pathname)) return NextResponse.next();
  const name = process.env["SESSION_COOKIE_NAME"] ?? "ls_session";
  if ((request.cookies.get(name)?.value ?? "") !== "") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "?next=" + encodeURIComponent(pathname + search);
  return NextResponse.redirect(url, 307);
}

export const config = { matcher: ["/((?!sign-in|api|_next|healthz|favicon\\.ico|.*\\..*).*)"] };
