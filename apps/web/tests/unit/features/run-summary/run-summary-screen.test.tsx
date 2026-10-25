import { cleanup, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { RunSummaryScreen } from "@/features/run-summary/run-summary-screen";
import { SESSIONS } from "@/test-utils/fixtures";
import { renderWithSession } from "@/test-utils/render-with-session";

type RunSummary = components["schemas"]["RunSummary"];

const GET = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a) },
}));

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  run_id: "run-0001",
  state: "complete",
  n: 3,
  wall_time_seconds: 612,
  cost_usd: 1.61,
  cost_per_ready_lesson_usd: 0.54,
  lessons: { ready: 3, failed: 0 },
  retries: 1,
  failures_by_reason: [{ reason: "truncated", count: 1 }],
  placeholders_left: 3,
  calls_lost_in_flight: 0,
  brakes_fired: [],
  truncation_retries: 0,
  p95_minutes_per_lesson: 3.4,
  target_minutes_per_lesson: 5,
  report_path: "/reports/run-0001.txt",
  ...over,
});

const show = (role: "author" | "reviewer" | "approver" = "author") =>
  renderWithSession(
    <RunSummaryScreen unitKey="g6-u4" runId="run-0001" />,
    role,
  );

beforeEach(() => {
  GET.mockReset();
  GET.mockResolvedValue({ data: summary() });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("RunSummaryScreen", () => {
  it("shows a skeleton while loading", () => {
    GET.mockReturnValue(new Promise(() => {}));
    show();
    expect(screen.getByText("Loading run summary")).toBeInTheDocument();
  });
  it("offers a retry when it cannot load", async () => {
    GET.mockRejectedValue(
      new ApiError({ status: 503, code: "SERVICE_BUSY", message: "x" }),
    );
    show();
    expect(
      await screen.findByText(/Couldn't load run summary/),
    ).toBeInTheDocument();
    const before = GET.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(GET.mock.calls.length).toBeGreaterThan(before);
  });
  it("shows not found for an unknown run", async () => {
    GET.mockRejectedValue(
      new ApiError({ status: 404, code: "NOT_FOUND", message: "x" }),
    );
    show();
    expect(
      await screen.findByText(/There is no run in Grade 6 · Unit 4/),
    ).toBeInTheDocument();
  });
  it("renders a finished run with its report link and no banner", async () => {
    show();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Run summary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Failures by reason" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Full-run report \(file\)/ }),
    ).toHaveAttribute("href", "/reports/run-0001.txt");
    expect(screen.queryByText(/still going/)).toBeNull();
  });
  it("reads No failures. for an empty table", async () => {
    GET.mockResolvedValue({ data: summary({ failures_by_reason: [] }) });
    show();
    expect(await screen.findByText("No failures.")).toBeInTheDocument();
  });
  it("shows the info banner for a running run", async () => {
    GET.mockResolvedValue({ data: summary({ state: "running" }) });
    show();
    expect(
      await screen.findByText("This run is still going. Numbers so far:"),
    ).toBeInTheDocument();
  });
  it("keeps the cards visible while stale", async () => {
    vi.useFakeTimers();
    GET.mockResolvedValueOnce({ data: summary({ state: "running" }) });
    GET.mockRejectedValue(
      new ApiError({ status: 503, code: "SERVICE_BUSY", message: "x" }),
    );
    show();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14000);
    });
    expect(screen.getByText(/Live updates paused/)).toBeInTheDocument();
    expect(screen.getByText("Wall time")).toBeInTheDocument();
  });
  it("shows plain text when no report is written", async () => {
    GET.mockResolvedValue({ data: summary({ report_path: null }) });
    show();
    await screen.findByText(/not written yet/);
    expect(screen.queryByRole("link", { name: /Full-run report/ })).toBeNull();
  });
  it("is identical and read-only for every role, with no person named", async () => {
    const texts: string[] = [];
    for (const role of ["author", "reviewer", "approver"] as const) {
      const { container, unmount } = show(role);
      await screen.findByRole("heading", { name: "Run summary" });
      texts.push(container.querySelector("dl")!.textContent ?? "");
      expect(within(container).queryAllByRole("button")).toEqual([]);
      for (const s of Object.values(SESSIONS))
        expect(container.textContent).not.toContain(s.user.name);
      unmount();
    }
    expect(texts[1]).toBe(texts[0]);
    expect(texts[2]).toBe(texts[0]);
  });
});
