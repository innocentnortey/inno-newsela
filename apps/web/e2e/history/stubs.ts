import type { Page } from "@playwright/test";
import { apiGlob } from "../../src/test-utils/sign-in-as";
import type { LessonHistory } from "./fixtures";

export interface Reply {
  status: number;
  json: unknown;
}

const HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "x-request-id",
  "x-request-id": "req-test",
};
const json = (r: Reply) => ({
  status: r.status,
  contentType: "application/json",
  headers: HEADERS,
  body: JSON.stringify(r.json),
});

export async function stubHistory(
  page: Page,
  history: LessonHistory | Reply,
  delayMs = 0,
): Promise<{ calls: number }> {
  const ctl = { calls: 0 };
  const reply: Reply =
    "status" in history ? history : { status: 200, json: history };
  await page.route(apiGlob("/lessons/*/history"), async (route) => {
    if (route.request().resourceType() === "document") return route.fallback();
    ctl.calls++;
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return route.fulfill(json(reply));
  });
  return ctl;
}
