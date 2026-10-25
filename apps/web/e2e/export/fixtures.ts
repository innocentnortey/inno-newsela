import type { Page } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { apiGlob } from "../../src/test-utils/sign-in-as";

export type ExportList = components["schemas"]["ExportList"];
export type ExportCreated = components["schemas"]["ExportCreated"];
export type ExportVersion = components["schemas"]["ExportVersion"];

// The query keeps the page URL from matching the api glob (apiGlob also matches page navigations).
export const EXPORT_URL = "/units/g6-u4/export?view=1";
const CORS = { "access-control-allow-origin": "*" };
const hash = (n: number) => `7b${String(n).padStart(62, "0")}`;

export const lessonsList = (over: Partial<ExportList> = {}): ExportList => ({
  included: ["G6.U4.L31", "G6.U4.L32", "G6.U4.L33"].map((lesson_id, i) => ({
    lesson_id,
    approved_hash: hash(31 + i),
  })),
  held_back: [
    {
      lesson_id: "G6.U4.L4",
      reason: "a lesson it links to is not approved",
      waits_on: "G6.U4.L5",
    },
  ],
  exports: [],
  ...over,
});

export const version = (
  n: number,
  over: Partial<ExportVersion> = {},
): ExportVersion => ({
  export_id: `exp-000${n}`,
  version_number: n,
  created_at: "2026-10-20T09:30:00Z",
  created_by: "user-approver",
  lesson_count: 3,
  payload_hash: hash(90 + n),
  ...over,
});

export const created = (
  n: number,
  over: Partial<ExportCreated> = {},
): ExportCreated => ({
  export_id: `exp-000${n}`,
  version_number: n,
  same_as_previous: false,
  included: lessonsList().included,
  held_back: [],
  download_path: `/exports/exp-000${n}/download`,
  ...over,
});

/** GET serves a mutable list; POST serves `create` and, when it is a new version, adds its row so the refetch shows it. */
export async function serveExports(
  page: Page,
  opts: { list: ExportList; create?: ExportCreated; abortCreate?: boolean },
) {
  const state = { list: opts.list, posts: 0, gets: 0 };
  await page.route(apiGlob("/units/*/exports"), async (route) => {
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
      state.posts++;
      if (opts.abortCreate) return route.abort();
      const body = opts.create ?? created(state.list.exports.length + 1);
      if (!body.same_as_previous)
        state.list = {
          ...state.list,
          exports: [
            ...state.list.exports,
            version(body.version_number, {
              export_id: body.export_id,
              lesson_count: body.included.length,
            }),
          ],
        };
      return route.fulfill({
        status: body.same_as_previous ? 200 : 201,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify(body),
      });
    }
    return route.fallback();
  });
  await page.route(apiGlob("/exports/*/download"), (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const id =
      /exports\/([^/]+)\/download/.exec(route.request().url())?.[1] ??
      "exp-0001";
    const n = Number(id.slice(-1)) || 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({
        export_id: id,
        version_number: n,
        label: "Export (no live integration)",
        payload_hash: hash(90 + n),
        lessons: [],
      }),
    });
  });
  return state;
}
