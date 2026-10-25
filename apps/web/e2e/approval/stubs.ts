// synthetic, traceable to WP-1 and the OpenAPI examples. Stubs the lesson reads and the approve transition.
import type { Page } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { errorStatus, type ErrorCode } from "../../src/test-utils/operations";
import { apiGlob } from "../../src/test-utils/sign-in-as";
import { HASH_A, SV_A, issuesNone, lesson5Submitted } from "./fixtures";

type Lesson = components["schemas"]["Lesson"];
type IssueList = components["schemas"]["IssueList"];
type History = components["schemas"]["LessonHistory"];
export interface Reply { status: number; json: unknown }

export interface Ctl {
  lesson: Lesson;
  issues: IssueList;
  history: History;
  issuesDelayMs: number;
  transition: (body: unknown) => Reply;
  posted: unknown[];
}

export function errorReply(code: ErrorCode, details?: Record<string, unknown>): Reply {
  return { status: errorStatus(code), json: { error: { code, message: "Test message for " + code, details: details ?? {} } } };
}

const successReply = (): Reply => ({
  status: 200,
  json: {
    lesson_id: "G6.U4.L5", from_state: "submitted", to_state: "approved",
    version: { version_id: "lv-5-2", version_number: 2, content_hash: HASH_A, state_vector: SV_A },
    audit_id: "aud-0150", dependency_record: [], metrics_row_written: true,
  },
});

const HEADERS = { "access-control-allow-origin": "*", "access-control-expose-headers": "x-request-id", "x-request-id": "req-test" };

export async function stubApproval(page: Page, init: Partial<Ctl> = {}): Promise<Ctl> {
  const lesson = init.lesson ?? lesson5Submitted();
  const ctl: Ctl = {
    lesson, issues: issuesNone(lesson.lesson_id), history: { versions: [], audit: [], ai_spans: [] },
    issuesDelayMs: 0, transition: successReply, posted: [], ...init,
  };
  const json = (r: Reply) => ({ status: r.status, contentType: "application/json", headers: HEADERS, body: JSON.stringify(r.json) });
  await page.route(apiGlob("/lessons/*"), (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill(json({ status: 200, json: ctl.lesson }));
  });
  await page.route(apiGlob("/lessons/*/issues"), async (route) => {
    if (ctl.issuesDelayMs) await new Promise((r) => setTimeout(r, ctl.issuesDelayMs));
    return route.fulfill(json({ status: 200, json: ctl.issues }));
  });
  await page.route(apiGlob("/lessons/*/history"), (route) => route.fulfill(json({ status: 200, json: ctl.history })));
  await page.route(apiGlob("/lessons/*/heartbeats"), (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...HEADERS, "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    return route.fulfill({ status: 204, headers: HEADERS });
  });
  await page.route(apiGlob("/lessons/*/transitions"), (route) => {
    const method = route.request().method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { ...HEADERS, "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (method !== "POST") return route.fallback();
    const body = route.request().postDataJSON() as unknown;
    ctl.posted.push(body);
    return route.fulfill(json(ctl.transition(body)));
  });
  return ctl;
}
