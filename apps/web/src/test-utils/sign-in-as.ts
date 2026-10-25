import type { Page } from "@playwright/test";
import type { Role } from "../lib/roles";
import { COLLAB_COOKIE, SESSIONS } from "./fixtures";

export const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "";

export function apiGlob(path: string): string {
  return `**${API_PREFIX}${path}`;
}

/** Signed-in page without a backend: cookie for the collab mock, and GET /session answered with the fixture. */
export async function signInAs(page: Page, role: Role): Promise<void> {
  await page.context().addCookies([{ ...COLLAB_COOKIE, domain: "localhost", path: "/" }]);
  await page.route(apiGlob("/session"), async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(SESSIONS[role]),
    });
  });
}

/** Sign-in flow without a backend: GET /session is 401 until a POST succeeds, then it returns that role's session. */
export async function signInFlow(page: Page, role: Role, delayMs = 0): Promise<void> {
  let signedIn = false;
  const cors = { "access-control-allow-origin": "*" };
  await page.route(apiGlob("/session"), async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      if (signedIn) {
        return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(SESSIONS[role]) });
      }
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        headers: { ...cors, "x-request-id": "req-test" },
        body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Test message for UNAUTHENTICATED", details: {} } }),
      });
    }
    if (method === "POST") {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      signedIn = true;
      // The real server sets the HttpOnly cookie on the app origin; the mock sits on another origin, so set it here.
      await page.context().addCookies([{ ...COLLAB_COOKIE, domain: "localhost", path: "/" }]);
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(SESSIONS[role]) });
    }
    return route.fallback();
  });
}
