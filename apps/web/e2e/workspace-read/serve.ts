import type { Page } from "@playwright/test";
import { apiGlob } from "../../src/test-utils/sign-in-as";
import type { components } from "../../src/lib/api-types";
import { ISSUES4, LESSON4 } from "./fixtures";

const headers = { "access-control-allow-origin": "*", "x-request-id": "req-test" };

export async function serveLesson(
  page: Page,
  opts: { lesson?: components["schemas"]["Lesson"]; issues?: components["schemas"]["IssueList"]; delayMs?: number } = {},
): Promise<void> {
  const { lesson = LESSON4, issues = ISSUES4, delayMs = 0 } = opts;
  const reply = (body: unknown) => async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });
  };
  await page.route(apiGlob("/lessons/*"), reply(lesson));
  await page.route(apiGlob("/lessons/*/issues"), reply(issues));
}

/**
 * apiGlob("/lessons/*") also matches the page URL /units/g6-u4/lessons/L4 (API_PREFIX is empty under Prism), so
 * the document request would be answered with JSON. Register this AFTER the API routes: a later route wins and
 * sends only navigation requests straight to the dev server.
 */
export async function passPageThrough(page: Page): Promise<void> {
  await page.route("**/units/*/lessons/*", (route) =>
    route.request().resourceType() === "document" ? route.continue() : route.fallback(),
  );
}
