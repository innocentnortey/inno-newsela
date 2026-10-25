import type { Page } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { API_PREFIX, apiGlob } from "../../src/test-utils/sign-in-as";

// Synthetic. Shapes follow CON-9 / CON-10 and WP-1's Lesson 4 row (draft, 3 blocking, 1 advisory, waits on Lesson 5's excerpt).
export type UnitBoard = components["schemas"]["UnitBoard"];
export type BoardRow = components["schemas"]["BoardRow"];
export type UnitMetrics = components["schemas"]["UnitMetrics"];
export type UnitList = { units: components["schemas"]["Unit"][] };

export const REVIEWER_NAMES = ["Reviewer A (demo)", "Reviewer B (demo)"];

function row(n: number, over: Partial<BoardRow> = {}): BoardRow {
  return {
    lesson_id: `G6.U4.L${n}`,
    lesson_key: `L${n}`,
    number: n,
    title: `Lesson ${n}: Synthetic title ${n}`,
    type: "Reading",
    state: "draft",
    blocking_count: 0,
    confirmation_count: 0,
    advisory_count: 0,
    reviewer: null,
    last_change_at: "2026-10-25T15:00:00Z",
    dependency_flags: [],
    send_back: null,
    judge_flag: null,
    ...over,
  };
}

export function makeRows(): BoardRow[] {
  const special = new Set([4, 5, 9, 10, 11, 12, 13, 14]);
  const rest: BoardRow[] = [];
  for (let n = 6; n <= 47; n++) {
    if (special.has(n)) continue;
    // 4 in review, the rest draft (32)
    rest.push(row(n, n <= 18 && n >= 15 ? { state: "in_review", reviewer: "Reviewer B (demo)" } : {}));
  }
  return [
    row(9, { state: "generation_failed", title: "Lesson 9: Failed to generate" }),
    row(10, { state: "generation_failed", title: "Lesson 10: Failed to generate" }),
    row(4, {
      title: "Lesson 4: The Lightning Thief, Chapter 1",
      blocking_count: 2,
      confirmation_count: 1,
      advisory_count: 1,
      dependency_flags: [{ kind: "waits_on", status: "slot_empty", lesson_id: "G6.U4.L5", label: "waits on Lesson 5: excerpt" }],
    }),
    row(5, { state: "submitted", reviewer: "Reviewer A (demo)", title: "Lesson 5: Chapter 2 excerpt" }),
    row(11, { state: "in_review", reviewer: "Reviewer B (demo)", title: "Lesson 11: Zebra habitats" }),
    row(12, {
      state: "in_review",
      title: "Lesson 12: Argument writing",
      send_back: { tag: "content_safety", note: "x", by: "Approver (demo)", at: "2026-10-25T15:00:00Z" },
    }),
    row(13, {
      title: "Lesson 13: Alpha vocabulary",
      dependency_flags: [{ kind: "source_reopened", status: null, lesson_id: "G6.U4.L2", label: "source reopened" }],
    }),
    row(14, {
      state: "submitted",
      title: "Lesson 14: Maps and routes",
      dependency_flags: [{ kind: "waits_on", status: "waiting_for_source_approval", lesson_id: "G6.U4.L3", label: "waits on Lesson 3" }],
      judge_flag: { verdict: "no", label: "Judge says no" },
    }),
    ...rest,
    row(3, { state: "approved", title: "Lesson 3: Approved three" }),
    row(2, { state: "approved", title: "Lesson 2: Approved two" }),
    row(1, { state: "approved", title: "Lesson 1: Approved one" }),
  ];
}

export function makeBoard(over: Partial<UnitBoard> = {}): UnitBoard {
  return {
    unit_id: "G6.U4",
    unit_key: "g6-u4",
    generated_at: "2026-10-25T15:26:02Z",
    rollup: { draft: 34, in_review: 6, submitted: 2, approved: 3, generation_failed: 2 },
    rows: makeRows(),
    ...over,
  };
}

const CAPTION = "No baseline yet (AQ-14). Measured with us as reviewers.";
export const METRICS_N3: UnitMetrics = {
  north_star: {
    median_minutes: 31,
    n: 3,
    fast_approvals: { count: 0, of: 3 },
    approved: { k: 3, total: 47 },
    caption: CAPTION,
    segment_label: "one reviewer, n = 3",
  },
  quality: null,
};
export const METRICS_N0: UnitMetrics = {
  north_star: {
    median_minutes: null,
    n: 0,
    fast_approvals: { count: 0, of: 0 },
    approved: { k: 0, total: 47 },
    caption: CAPTION,
    segment_label: null,
  },
  quality: null,
};

function units(state: components["schemas"]["RunState"]): UnitList {
  return {
    units: [
      {
        unit_id: "G6.U4",
        unit_key: "g6-u4",
        title: "Grade 6 · Unit 4 · The Lightning Thief",
        versions: [
          {
            outline_version_id: "ov-0002",
            unit_id: "G6.U4",
            unit_key: "g6-u4",
            version_number: 2,
            sha256: "0".repeat(64),
            same_as_version: null,
            changed_lessons: 0,
            row_counts: { lessons: 40, flex_days: 5, arc_headers: 2, total_rows: 47 },
            created_at: "2026-10-25T14:00:00Z",
            created_by: "Author (demo)",
          },
        ],
        latest_run: { run_id: "run-0001", state },
      },
    ],
  };
}
export const UNITS_RUNNING = units("running");
export const UNITS_COMPLETE = units("complete");

export interface BoardControl {
  /** Set to a status to make board calls fail (non-JSON body, so the client reports NETWORK); null = healthy. */
  failBoard: number | null;
  boardCalls: number;
}

export interface RouteOpts {
  board?: (state: string | null) => UnitBoard;
  metrics?: UnitMetrics | "error";
  units?: UnitList;
  boardGate?: Promise<void>;
  boardStatus?: number;
}

const CORS = { "access-control-allow-origin": "*", "x-request-id": "req-test", "access-control-expose-headers": "x-request-id" };

/** Register AFTER signInAs so these win. Prism has no 500 for getUnitBoard, so failures are fulfilled here. */
export async function routeBoard(page: Page, opts: RouteOpts = {}): Promise<BoardControl> {
  const ctl: BoardControl = { failBoard: opts.boardStatus ?? null, boardCalls: 0 };
  const isApi = (url: string) => new URL(url).port === "4010";

  await page.route(new RegExp(`${API_PREFIX}/units/[^/]+/board(\\?.*)?$`), async (route) => {
    if (route.request().method() !== "GET" || !isApi(route.request().url())) return route.fallback();
    ctl.boardCalls += 1;
    if (opts.boardGate) await opts.boardGate;
    if (ctl.failBoard) {
      return route.fulfill({ status: ctl.failBoard, contentType: "text/html", headers: CORS, body: "<html>error</html>" });
    }
    const state = new URL(route.request().url()).searchParams.get("state");
    const full = opts.board ? opts.board(state) : makeBoard();
    const body = state ? { ...full, rows: full.rows.filter((r) => r.state === state) } : full;
    return route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(body) });
  });

  await page.route(apiGlob("/units/*/metrics"), async (route) => {
    if (route.request().method() !== "GET" || !isApi(route.request().url())) return route.fallback();
    if (opts.metrics === "error") {
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify({ error: { code: "SERVICE_BUSY", message: "Test message for SERVICE_BUSY", details: {} } }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(opts.metrics ?? METRICS_N3) });
  });

  await page.route(apiGlob("/units"), async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET" || !isApi(route.request().url()) || !url.pathname.endsWith("/units")) return route.fallback();
    return route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(opts.units ?? UNITS_COMPLETE) });
  });

  return ctl;
}
