// synthetic, copied from the OpenAPI onePending / accepted examples (CON-17); no student work.
import type { Page } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { apiGlob } from "../../src/test-utils/sign-in-as";
import { lesson5Submitted } from "../approval/fixtures";
import { stubApproval, type Ctl as ApprovalCtl } from "../approval/stubs";

type Suggestion = components["schemas"]["Suggestion"];
type Lesson = components["schemas"]["Lesson"];

export const SELECTED = "Connection to Today's Learning";
export const onePending: Suggestion = {
  suggestion_id: "sug-4-1",
  status: "pending",
  anchor: { start: "AQSH6qQEAgA=", end: "AQSH6qQEBgA=" },
  selected_text: SELECTED,
  suggested_text: "How might a storyteller's voice change the way you hear a story?",
  requested_by: "Reviewer A (demo)",
  expires_at: "2026-10-25T16:20:00Z",
  decided_by: null,
  content_hash: null,
};
export const accepted: Suggestion = { ...onePending, status: "accepted", decided_by: "Reviewer A (demo)", content_hash: "9f3c" + "0".repeat(56) + "a21e" };
export const inReviewLesson = (): Lesson => ({ ...lesson5Submitted(), state: "in_review" });

export interface Recorded { method: string; path: string; body: unknown }
export interface AssistCtl extends ApprovalCtl {
  list: Suggestion[];
  requests: Recorded[];
  created: Suggestion;
}

const HEADERS = { "access-control-allow-origin": "*", "access-control-expose-headers": "x-request-id", "x-request-id": "req-test" };
const PREFLIGHT = { ...HEADERS, "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

/** Serves the CON-17 reads and writes and records every one; lesson and issue reads come from stubApproval. */
export async function stubAssist(page: Page, init: { list?: Suggestion[]; created?: Suggestion } = {}): Promise<AssistCtl> {
  const base = await stubApproval(page, { lesson: inReviewLesson() });
  const ctl: AssistCtl = { ...base, list: init.list ?? [], requests: [], created: init.created ?? onePending };
  const json = (status: number, body: unknown) => ({ status, contentType: "application/json", headers: HEADERS, body: JSON.stringify(body) });
  const record = (route: import("@playwright/test").Route) => {
    const r = route.request();
    ctl.requests.push({ method: r.method(), path: new URL(r.url()).pathname, body: r.postData() ? r.postDataJSON() : null });
  };
  await page.route(apiGlob("/lessons/*/suggestions"), (route) => {
    const method = route.request().method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: PREFLIGHT });
    record(route);
    if (method === "POST") {
      ctl.list = [ctl.created];
      return route.fulfill(json(201, ctl.created));
    }
    return route.fulfill(json(200, { suggestions: ctl.list }));
  });
  await page.route(apiGlob("/lessons/*/suggestions/*/decision"), (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: PREFLIGHT });
    record(route);
    const body = route.request().postDataJSON() as { decision: string };
    const prior = ctl.list[0] ?? ctl.created;
    ctl.list = [];
    return route.fulfill(json(200, body.decision === "accept" ? { ...prior, ...accepted, suggestion_id: prior.suggestion_id } : { ...prior, status: "rejected" }));
  });
  return ctl;
}
