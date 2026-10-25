import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { UnitPlanScreen } from "@/features/unit-plan/unit-plan-screen";
import { renderWithSession } from "@/test-utils/render-with-session";

const GET = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a) },
}));
let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

const entry = (day: number) => ({
  lesson_id: "G6.U4.L" + day,
  day,
  purpose: "Synthetic plan line for day " + day,
  routines: [],
  hands_forward: "Synthetic hand-forward from day " + day,
  performance_task_thread: "Thread",
});
const stored = (over = {}) => ({
  run_id: "run-0001",
  state: "stored",
  stored_at: "2026-10-25T15:21:10Z",
  entries: [entry(5), entry(4), entry(3)],
  lesson_links: [
    {
      link_id: "lnk-4-5",
      from_lesson_id: "G6.U4.L4",
      from_address: "G6.U4.L4.Homework",
      to_lesson_id: "G6.U4.L5",
      to_slot_id: "s",
      label: "Lesson 4 Homework → Lesson 5 excerpt slot",
    },
  ],
  ...over,
});
let current: unknown;

beforeEach(() => {
  GET.mockReset();
  search = "";
  current = stored();
  GET.mockImplementation(async () => {
    if (current === "pending") return new Promise(() => {});
    if (current instanceof Error) throw current;
    return { data: current };
  });
});
afterEach(cleanup);

const show = (role: "author" | "reviewer" | "approver" = "author") =>
  renderWithSession(<UnitPlanScreen unitKey="g6-u4" runId="run-0001" />, role);

describe("UnitPlanScreen", () => {
  it("shows a skeleton while loading", () => {
    current = "pending";
    show();
    expect(screen.getByText("Loading the unit plan")).toBeInTheDocument();
  });
  it("lists entries in day order", async () => {
    show();
    const items = await screen.findAllByRole("listitem");
    const days = items
      .map((li) => /^Day (\d+)/.exec(li.textContent ?? "")?.[1])
      .filter(Boolean);
    expect(days).toEqual(["3", "4", "5"]);
    expect(
      screen.getByText("Hands forward: Synthetic hand-forward from day 4"),
    ).toBeInTheDocument();
  });
  it("rail row links both lessons", async () => {
    show();
    expect(
      await screen.findByRole("link", { name: "Lesson 4 Homework" }),
    ).toHaveAttribute("href", "/units/g6-u4/lessons/L4");
    expect(
      screen.getByRole("link", { name: "Lesson 5 excerpt slot" }),
    ).toHaveAttribute("href", "/units/g6-u4/lessons/L5");
  });
  it("shows the planning banner and no list", async () => {
    current = stored({ state: "planning", entries: [], lesson_links: [] });
    show();
    expect(
      await screen.findByText(
        "The plan is being written (one call). It appears here before any lesson is drafted.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Teaching days" })).toBeNull();
  });
  it("says when there is no plan yet", async () => {
    current = stored({ entries: [], lesson_links: [] });
    show();
    expect(
      await screen.findByText("No plan yet. A run writes the plan first."),
    ).toBeInTheDocument();
    expect(screen.getByText("No links between lessons.")).toBeInTheDocument();
  });
  it("says the run is paused when the plan failed", async () => {
    current = stored({ state: "failed", entries: [], lesson_links: [] });
    show();
    expect(
      await screen.findByText(/The plan couldn't be written/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the run" })).toHaveAttribute(
      "href",
      "/units/g6-u4/runs/run-0001",
    );
  });
  it("offers a retry when it cannot load", async () => {
    current = new ApiError({ status: 503, code: "SERVICE_BUSY", message: "x" });
    show();
    const retry = await screen.findByRole("button", { name: "Retry" });
    const n = GET.mock.calls.length;
    await userEvent.click(retry);
    await waitFor(() => expect(GET.mock.calls.length).toBeGreaterThan(n));
  });
  it("says when the plan does not exist", async () => {
    current = new ApiError({ status: 404, code: "NOT_FOUND", message: "x" });
    show();
    expect(
      await screen.findByText("There is no plan in Grade 6 · Unit 4"),
    ).toBeInTheDocument();
  });
  it("focuses the day from ?day", async () => {
    search = "day=5";
    show();
    await screen.findByRole("list", { name: "Teaching days" });
    await waitFor(() => expect(document.activeElement?.id).toBe("day-5"));
  });
  it.each(["author", "reviewer", "approver"] as const)(
    "has no buttons for %s",
    async (role) => {
      show(role);
      await screen.findByRole("list", { name: "Teaching days" });
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    },
  );
});
