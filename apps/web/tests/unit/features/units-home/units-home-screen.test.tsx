import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnitsHomeScreen } from "@/features/units-home/units-home-screen";
import { ApiError } from "@/lib/api-client";
import { renderWithSession } from "@/test-utils/render-with-session";

const GET = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a) },
}));

const UNITS = {
  units: [
    {
      unit_id: "G6.U4",
      unit_key: "g6-u4",
      title: "Grade 6 · Unit 4",
      versions: [
        {
          outline_version_id: "G6.U4.ov2",
          unit_id: "G6.U4",
          unit_key: "g6-u4",
          version_number: 2,
          sha256: "a1" + "0".repeat(62),
          same_as_version: 1,
          changed_lessons: 0,
          row_counts: { lessons: 41, flex_days: 6, arc_headers: 7, total_rows: 1 },
          created_at: "2026-10-25T15:02:00Z",
          created_by: "Author (demo)",
        },
      ],
      latest_run: { run_id: "run-0001", state: "running" },
    },
  ],
};
const PROGRESS = { counts_by_tile_state: { ready: 1, drafting: 2 } };
const withData = (units: unknown) =>
  GET.mockImplementation(async (path: string) => (path === "/units" ? { data: units } : { data: PROGRESS }));

beforeEach(() => {
  GET.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("UnitsHomeScreen", () => {
  it("shows a skeleton while loading", () => {
    GET.mockReturnValue(new Promise(() => {}));
    renderWithSession(<UnitsHomeScreen />);
    expect(screen.getByTestId("units-skeleton")).toBeInTheDocument();
    expect(screen.getAllByTestId("units-skeleton-row")).toHaveLength(3);
  });
  it("shows the empty sentence and one Upload outline link to /units/g6-u4/outlines/new for an author", async () => {
    withData({ units: [] });
    renderWithSession(<UnitsHomeScreen />);
    expect(
      await screen.findByText("No outline uploaded yet. Upload the unit's outline sheet to see its validation report before any lesson is drafted."),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Upload outline" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/units/g6-u4/outlines/new");
  });
  it("shows the can't-load message and recovers on Retry", async () => {
    GET.mockRejectedValueOnce(new ApiError({ status: 503, code: "SERVICE_BUSY", message: "x" }));
    withData(UNITS);
    renderWithSession(<UnitsHomeScreen />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load units. Check your connection and try again.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "Grade 6 · Unit 4" })).toBeInTheDocument();
    expect(GET.mock.calls.filter((c) => c[0] === "/units")).toHaveLength(2);
  });
  it.each(["reviewer", "approver"] as const)("hides Upload outline and Prompt guidance from %s", async (role) => {
    withData(UNITS);
    renderWithSession(<UnitsHomeScreen />, role);
    await screen.findByRole("link", { name: "Grade 6 · Unit 4" });
    expect(screen.queryByRole("link", { name: "Upload outline" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Prompt guidance" })).toBeNull();
  });
  it("shows both to an author", async () => {
    withData(UNITS);
    renderWithSession(<UnitsHomeScreen />);
    await screen.findByRole("link", { name: "Grade 6 · Unit 4" });
    expect(screen.getByRole("link", { name: "Upload outline" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prompt guidance" })).toHaveAttribute("href", "/prompt-guidance");
  });
  it("asks for progress once and never polls", async () => {
    withData(UNITS);
    renderWithSession(<UnitsHomeScreen />);
    await screen.findByRole("link", { name: "Grade 6 · Unit 4" });
    const n = GET.mock.calls.length;
    expect(n).toBe(2);
    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(GET.mock.calls.length).toBe(n);
  });
});
