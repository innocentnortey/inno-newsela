import type { Page } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { apiGlob } from "../../src/test-utils/sign-in-as";
import { makeBoard } from "../board/board-fixtures";
import { mockOperation } from "../../src/test-utils/mock-operation";

export type PromptVersions = components["schemas"]["PromptVersions"];
export type GuidanceVersion = components["schemas"]["GuidanceVersion"];

// The query keeps the page URL from matching the api glob (apiGlob also matches page navigations).
export const PG_URL = "/prompt-guidance?view=1";
export const LOCKED_SENTINEL = "LOCKED-SENTINEL-7f3a";
const CORS = { "access-control-allow-origin": "*" };

const v1: GuidanceVersion = {
  version_id: "guidance-1",
  number: 1,
  author: "Author (demo)",
  created_at: "2026-10-25T14:00:00Z",
  reason: "First guidance",
  diff: "",
  pinned_by_runs: ["run-0001"],
};
export const v2: GuidanceVersion = {
  version_id: "guidance-2",
  number: 2,
  author: "Author (demo)",
  created_at: "2026-10-25T16:30:00Z",
  reason: "Reviewers asked for a steadier Launch routine.",
  diff: "+ Prefer Think-Pair-Share in Launch; keep Quick Write in Look Back.\n- Open every lesson with a quiz.\n  Keep the Exit Ticket.",
  pinned_by_runs: [],
};

export const versionsV1 = (): PromptVersions => ({
  current_prompt_version_id: "pv-locked1-guidance1",
  locked_layer: {
    version_id: "locked-1",
    text: `[locked layer: ${LOCKED_SENTINEL}; read-only]`,
  },
  guidance_versions: [v1],
});
export const versionsV2 = (): PromptVersions => {
  const base = versionsV1();
  return {
    ...base,
    current_prompt_version_id: "pv-locked1-guidance2",
    guidance_versions: [v1, v2],
  };
};

export interface Calls {
  saves: unknown[];
  runs: { body: unknown; key: string | undefined }[];
  bodies: string[];
}

/** GET serves a mutable list; POST records the body and serves `saved` (201), which then shows in the list. */
export async function servePromptVersions(
  page: Page,
  opts: { list?: PromptVersions; first409?: boolean; abort?: boolean } = {},
) {
  const state = {
    list: opts.list ?? versionsV1(),
    saves: [] as unknown[],
    gets: 0,
  };
  let stale = opts.first409 ?? false;
  await page.route(apiGlob("/prompt-versions"), async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      state.gets++;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify(state.list),
      });
    }
    if (method === "POST") {
      state.saves.push(route.request().postDataJSON());
      if (opts.abort) return route.abort();
      if (stale) {
        stale = false;
        state.list = versionsV2();
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          headers: CORS,
          body: JSON.stringify({
            error: {
              code: "STALE_BASE",
              message: "Test message for STALE_BASE",
              details: { latest_version_id: "guidance-2" },
            },
          }),
        });
      }
      const req = state.saves[state.saves.length - 1] as {
        guidance_text: string;
        reason: string;
      };
      const n = state.list.guidance_versions.length + 1;
      const saved: GuidanceVersion = {
        ...v2,
        version_id: `guidance-${n}`,
        number: n,
        reason: req.reason,
        diff: `+ ${req.guidance_text}`,
      };
      state.list = {
        ...state.list,
        guidance_versions: [...state.list.guidance_versions, saved],
      };
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify(saved),
      });
    }
    return route.fallback();
  });
  return state;
}

export async function serveBoard(page: Page) {
  await page.route(apiGlob("/units/*/board"), (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify(makeBoard()),
    });
  });
}

export async function serveUnits(page: Page) {
  await mockOperation(page, "listUnits", { example: "oneUnit" });
}

/** POST /runs records the body and key; the lesson history shows the candidate from the 2nd call on. */
export async function serveTrial(
  page: Page,
  opts: { fail?: { status: number; code: string; details?: object } } = {},
) {
  const calls: Calls = { saves: [], runs: [], bodies: [] };
  let histories = 0;
  await page.route(apiGlob("/runs"), (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    calls.runs.push({
      body: route.request().postDataJSON(),
      key: route.request().headers()["idempotency-key"],
    });
    if (opts.fail)
      return route.fulfill({
        status: opts.fail.status,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({
          error: {
            code: opts.fail.code,
            message: "Test message",
            details: opts.fail.details ?? {},
          },
        }),
      });
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ run_id: "run-trial-1", state: "planning" }),
    });
  });
  await page.route(apiGlob("/lessons/*/history"), (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    histories++;
    const versions =
      histories < 2
        ? []
        : [
            {
              version_id: "cand-4-2",
              version_number: 2,
              kind: "candidate",
              content_hash: "a".repeat(64),
              created_at: "2026-10-26T09:00:00Z",
              created_by: "Author (demo)",
              adopted: null,
              provenance: {
                outline_row_hash: "b".repeat(64),
                prompt_version_id: "pv-locked1-guidance1",
                model: "stub",
                parameters: null,
                schema_version: 1,
                example_set_id: null,
                run_id: "run-trial-1",
                cost_usd: 0.49,
                derived_from_version_id: null,
              },
            },
          ];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ versions, audit: [], ai_spans: [] }),
    });
  });
  return calls;
}
