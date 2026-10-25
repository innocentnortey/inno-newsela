import type { Page, Route } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { apiGlob } from "../../src/test-utils/sign-in-as";
import { LESSON4 } from "../workspace-read/fixtures";
import { ADOPT_RESULT, CAND_READY, CAND_DRAFTING } from "./fixtures";

type Lesson = components["schemas"]["Lesson"];
type Candidate = components["schemas"]["Candidate"];

const cors = { "access-control-allow-origin": "*", "access-control-expose-headers": "x-request-id", "x-request-id": "req-test" };

export interface ServeOpts {
  lessonState?: Lesson["state"];
  /** The candidate the stub answers once it is no longer drafting. */
  candidate?: Candidate;
  /** GETs answered "drafting" before the candidate shows. 0 = ready at once. */
  readyAfterPolls?: number;
}

/** Stateful stub: lesson read, candidate poll, adopt. Registered first, so error stubs registered later win. */
export async function serveCandidate(page: Page, opts: ServeOpts = {}) {
  const calls = { adopts: [] as unknown[], candidateGets: 0 };
  const lesson = { ...LESSON4, state: opts.lessonState ?? "in_review" } as Lesson;
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

  await page.route(apiGlob("/lessons/*"), (route) => {
    if (route.request().resourceType() === "document") return route.continue();
    return route.request().method() === "GET" ? json(route, lesson) : route.fallback();
  });
  await page.route(apiGlob("/lessons/*/candidates/*"), (route) => {
    if (route.request().resourceType() === "document") return route.continue();
    if (route.request().method() !== "GET") return route.fallback();
    calls.candidateGets += 1;
    const drafting = calls.candidateGets <= (opts.readyAfterPolls ?? 0);
    return json(route, drafting ? CAND_DRAFTING : (opts.candidate ?? CAND_READY));
  });
  await page.route(apiGlob("/lessons/*/candidates/*/adopt"), (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    calls.adopts.push(route.request().postDataJSON());
    return json(route, ADOPT_RESULT);
  });
  return calls;
}
