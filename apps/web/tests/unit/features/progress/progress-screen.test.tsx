import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { ProgressScreen } from "@/features/progress/progress-screen";
import { renderWithSession } from "@/test-utils/render-with-session";
import { progress, tile, type RunProgress } from "./fixtures";

const GET = vi.fn();
const POST = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: {
    GET: (...a: unknown[]) => GET(...a),
    POST: (...a: unknown[]) => POST(...a),
  },
}));

let current: RunProgress | Error | "pending";
const progressCalls = () =>
  GET.mock.calls.filter((c) => c[0] === "/runs/{runId}/progress").length;

beforeEach(() => {
  GET.mockReset();
  POST.mockReset();
  current = progress("running", [tile(4, "drafting"), tile(5, "queued")]);
  GET.mockImplementation(async (path: string) => {
    if (path === "/runs/{runId}/summary")
      return { data: { calls_lost_in_flight: 0 } };
    if (current === "pending") return new Promise(() => {});
    if (current instanceof Error) throw current;
    return { data: current };
  });
  POST.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

const show = (role: "author" | "approver" = "author") =>
  renderWithSession(<ProgressScreen unitKey="g6-u4" runId="run-0001" />, role);

describe("ProgressScreen", () => {
  it("shows a skeleton while loading", () => {
    current = "pending";
    show();
    expect(screen.getByText("Loading run progress")).toBeInTheDocument();
  });
  it("offers a retry when it cannot load", async () => {
    current = new ApiError({ status: 503, code: "SERVICE_BUSY", message: "x" });
    show();
    expect(
      await screen.findByText(
        "Couldn't load run progress. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
  });
  it("says when the run does not exist", async () => {
    current = new ApiError({ status: 404, code: "NOT_FOUND", message: "x" });
    show();
    expect(
      await screen.findByText("There is no run in Grade 6 · Unit 4"),
    ).toBeInTheDocument();
  });

  const t = [
    tile(1, "ready"),
    tile(2, "failed", {
      failure_reasons: [
        { check: "check_failed", message: "Look Back is 3 minutes (needs 5)" },
      ],
      repair_used: true,
    }),
  ];
  const cases: [string, RunProgress, string][] = [
    [
      "partial",
      progress("partial", t),
      "Run partial: 1 of 2 failed. Ready lessons are reviewable.",
    ],
    [
      "capped",
      progress("capped", t, { capped_by: "run_cap" }),
      "Run capped: the next call would pass the $5.00 cap. No new calls start. To finish, start a new run on the unfinished rows.",
    ],
    [
      "paused",
      progress("paused", t, {
        paused_reason: { check: "check_failed", lesson_ids: ["G6.U4.L2"] },
      }),
      "Run paused: 1 lessons in a row failed the same check (Look Back is 3 minutes (needs 5)). Read the failures, then resume.",
    ],
    [
      "cancelled",
      progress("cancelled", t),
      "Run cancelled. Calls in flight finished and were stored.",
    ],
    [
      "complete",
      progress("complete", [tile(1, "ready"), tile(2, "ready")]),
      "Run complete: 2 of 2 ready.",
    ],
  ];
  for (const [name, p, text] of cases) {
    it(`state ${name} banner`, async () => {
      current = p;
      show();
      expect(await screen.findByText(text)).toBeInTheDocument();
    });
  }

  it("shows the failure reason on a failed tile and the cost text", async () => {
    current = progress("partial", t);
    show();
    expect(
      await screen.findByText(
        "Failed after 1 repair: Look Back is 3 minutes (needs 5)",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "$1.84 of $5.00 cap",
    );
  });
  it("says calls were lost after a restart", async () => {
    GET.mockImplementation(async (path: string) => ({
      data: path.includes("summary") ? { calls_lost_in_flight: 1 } : current,
    }));
    show();
    expect(
      await screen.findByText(
        /The run resumed after a restart. 1 call lost in flight./,
      ),
    ).toBeInTheDocument();
  });

  it("gives non-authors no buttons", async () => {
    current = progress("paused", t, {
      paused_reason: { check: "x", lesson_ids: [] },
    });
    show("approver");
    expect(
      await screen.findByText("Only authors can control a run"),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(POST).not.toHaveBeenCalled();
  });

  it("asks before cancelling", async () => {
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel run" }),
    );
    expect(
      screen.getByText(
        "Cancel the run? Calls in flight will finish; no new calls start.",
      ),
    ).toBeInTheDocument();
    expect(POST).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Keep running" }));
    expect(screen.queryByText(/Cancel the run\?/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel run" }));
    await userEvent.click(within_group());
    await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));
    expect(POST).toHaveBeenCalledWith("/runs/{runId}/actions", {
      params: { path: { runId: "run-0001" } },
      body: { action: "cancel" },
    });
  });

  it("shows a failed control and keeps the tiles", async () => {
    current = progress("partial", t);
    POST.mockRejectedValue(
      new ApiError({ status: 503, code: "SERVICE_BUSY", message: "x" }),
    );
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "Retry failed" }),
    );
    expect(
      await screen.findByText("Couldn't retry. Nothing changed. Try again."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Lessons in this run" }),
    ).toBeInTheDocument();
  });
  it("re-reads progress after INVALID_TRANSITION", async () => {
    current = progress("partial", t);
    POST.mockRejectedValue(
      new ApiError({ status: 409, code: "INVALID_TRANSITION", message: "x" }),
    );
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "Retry failed" }),
    );
    await screen.findByText("Couldn't retry. Nothing changed. Try again.");
    await waitFor(() => expect(progressCalls()).toBeGreaterThanOrEqual(2));
  });
});

function within_group(): HTMLElement {
  const group = screen.getByRole("group", { name: "Confirm cancel" });
  return Array.from(group.querySelectorAll("button")).find(
    (b) => b.textContent === "Cancel run",
  )!;
}
