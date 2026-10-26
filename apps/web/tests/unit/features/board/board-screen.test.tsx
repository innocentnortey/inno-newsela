import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardScreen } from "@/features/board/board-screen";
import { renderWithSession } from "@/test-utils/render-with-session";
import type { components } from "@/lib/api-types";

type BoardRow = components["schemas"]["BoardRow"];

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/units/g6-u4/board",
  useSearchParams: () => new URLSearchParams(search),
}));

const GET = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({ ...(await orig<typeof import("@/lib/api-client")>()), api: { GET: (...a: unknown[]) => GET(...a) } }));

const mkRow = (key: string, over: Partial<BoardRow> = {}): BoardRow => ({
  lesson_id: `G6.U4.${key}`,
  lesson_key: key,
  number: Number(key.slice(1)),
  title: `Title of ${key}`,
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
});
const L4 = mkRow("L4", {
  blocking_count: 2,
  confirmation_count: 1,
  advisory_count: 1,
  dependency_flags: [{ kind: "waits_on", status: "slot_empty", lesson_id: "G6.U4.L5", label: "x" }],
});
const L2 = mkRow("L2", { state: "in_review", reviewer: "Reviewer B (demo)" });
const L9 = mkRow("L9", { state: "generation_failed" });
const metrics = {
  north_star: {
    median_minutes: 31,
    n: 3,
    fast_approvals: { count: 0, of: 3 },
    approved: { k: 3, total: 47 },
    caption: "No baseline yet (AQ-14). Measured with us as reviewers.",
    segment_label: null,
  },
  quality: null,
};
const unit = (state = "complete") => ({
  units: [
    {
      unit_id: "G6.U4",
      unit_key: "g6-u4",
      title: "Grade 6 · Unit 4 · The Lightning Thief",
      versions: [{ version_number: 1 }, { version_number: 2 }],
      latest_run: { run_id: "run-0001", state },
    },
  ],
});

interface Server {
  rows: BoardRow[];
  rollup: Record<string, number>;
  boardFail: boolean;
  metricsFail: boolean;
  runState: string;
  gate: Promise<void> | null;
}
let s: Server;
beforeEach(() => {
  search = "";
  replace.mockReset();
  s = { rows: [L9, L4, L2], rollup: { draft: 1, in_review: 1, generation_failed: 1 }, boardFail: false, metricsFail: false, runState: "complete", gate: null };
  GET.mockReset();
  GET.mockImplementation(async (path: string, init?: { params?: { query?: { state?: string } } }) => {
    if (path === "/units/{unitId}/board") {
      if (s.gate) await s.gate;
      if (s.boardFail) throw new Error("down");
      const st = init?.params?.query?.state;
      return { data: { unit_id: "G6.U4", unit_key: "g6-u4", generated_at: "x", rollup: s.rollup, rows: st ? s.rows.filter((r) => r.state === st) : s.rows } };
    }
    if (path === "/units/{unitId}/metrics") {
      if (s.metricsFail) throw new Error("down");
      return { data: metrics };
    }
    return { data: unit(s.runState) };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
async function mount(role: "author" | "reviewer" | "approver" = "reviewer") {
  vi.useFakeTimers();
  renderWithSession(<BoardScreen unitKey="g6-u4" />, role);
  await settle();
}

describe("BoardScreen", () => {
  it("loading shows 5 cells and 8 rows", async () => {
    let release!: () => void;
    s.gate = new Promise<void>((r) => (release = r));
    await mount();
    expect(document.querySelectorAll('[data-skeleton="rollup-cell"]')).toHaveLength(5);
    expect(document.querySelectorAll('[data-skeleton="row"]')).toHaveLength(8);
    release();
  });

  it("success lists rows in server order", async () => {
    await mount();
    const links = screen.getAllByRole("link").map((l) => l.textContent).filter((t) => t?.startsWith("Title of"));
    expect(links).toEqual(["Title of L9", "Title of L4", "Title of L2"]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Unit 4");
  });

  it("lesson 4 row note and counts", async () => {
    await mount();
    expect(screen.getByText("Waits on Lesson 5's excerpt")).toBeTruthy();
    const row = screen.getByText("Title of L4").closest("tr")!;
    const cells = row.querySelectorAll("td");
    expect(cells[3]!.textContent).toContain("3");
    expect(cells[4]!.textContent).toBe("1");
    expect(cells[2]!.textContent).toContain("Draft");
  });

  it("filter radio calls replace and refetches with state", async () => {
    await mount();
    GET.mockClear();
    fireEvent.click(screen.getByRole("radio", { name: "In review" }));
    expect(replace).toHaveBeenCalledWith("/units/g6-u4/board?state=in_review", { scroll: false });
    await settle();
    expect(GET.mock.calls.some((c) => c[0] === "/units/{unitId}/board")).toBe(true);
  });

  it("filter refetch passes the state query", async () => {
    search = "state=in_review";
    await mount();
    const call = GET.mock.calls.find((c) => c[0] === "/units/{unitId}/board")!;
    expect(call[1].params.query).toEqual({ state: "in_review" });
    expect(screen.queryByText("Title of L4")).toBeNull();
    expect(screen.getByText("Title of L2")).toBeTruthy();
  });

  it("empty filter message and Show all lessons", async () => {
    search = "state=approved";
    await mount();
    expect(screen.getByText("No lessons are Approved.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all lessons" }));
    expect(replace).toHaveBeenCalledWith("/units/g6-u4/board", { scroll: false });
  });

  it("first use author link", async () => {
    s.rows = [];
    s.rollup = {};
    await mount("author");
    expect(screen.getByText("No lessons generated for this unit yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to the validation report" }).getAttribute("href")).toBe("/units/g6-u4/outlines/2");
    expect(document.querySelector('[data-skeleton="tile"]')).toBeNull();
    expect(screen.queryByText("Reviewer minutes per approved lesson")).toBeNull();
  });

  it("unit with no outline shows the empty state", async () => {
    const { ApiError } = await import("@/lib/api-client");
    GET.mockReset().mockRejectedValue(new ApiError({ status: 404, code: "NOT_FOUND", message: "There is no unit" }));
    await mount("author");
    expect(screen.getByText("No lessons generated for this unit yet.")).toBeTruthy();
    expect(screen.getByText("Lessons appear here as a run drafts them.")).toBeTruthy();
    expect(screen.queryByText(/There is no unit/)).toBeNull();
    expect(screen.getByRole("link", { name: "Upload an outline" }).getAttribute("href")).toBe("/units/g6-u4/outlines/new");
    expect(screen.queryByText("Reviewer minutes per approved lesson")).toBeNull();
    cleanup();
    await mount("reviewer");
    expect(screen.queryByRole("link", { name: "Upload an outline" })).toBeNull();
    expect(screen.queryByRole("link", { name: "See the latest run" })).toBeNull();
  });

  it("first use reviewer link", async () => {
    s.rows = [];
    s.rollup = {};
    await mount("reviewer");
    expect(screen.getByRole("link", { name: "See the latest run" }).getAttribute("href")).toBe("/units/g6-u4/runs/run-0001");
  });

  it("run banner text and link", async () => {
    s.runState = "running";
    await mount();
    expect(screen.getByText("Run in progress: 3 of 47 lessons ready.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Watch progress" }).getAttribute("href")).toBe("/units/g6-u4/runs/run-0001");
  });

  it("board error shows CantLoad and Retry refetches", async () => {
    s.boardFail = true;
    await mount();
    expect(screen.getByText("Couldn't load the unit board. Check your connection and try again.")).toBeTruthy();
    s.boardFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await settle();
    expect(screen.getByText("Title of L4")).toBeTruthy();
  });

  it("tile error leaves table", async () => {
    s.metricsFail = true;
    await mount();
    expect(screen.getByText("Couldn't load the north-star numbers.")).toBeTruthy();
    expect(screen.getByText("Title of L4")).toBeTruthy();
  });

  it("stale banner after 10 s keeps rows", async () => {
    await mount();
    s.boardFail = true;
    await advance(13000);
    expect(screen.getByText(/Live updates paused/)).toBeTruthy();
    expect(screen.getByText("Title of L4")).toBeTruthy();
  });

  it("poll does not move focus", async () => {
    await mount();
    const link = screen.getByText("Title of L4");
    link.focus();
    await advance(2100);
    expect(document.activeElement).toBe(screen.getByText("Title of L4"));
    expect(document.activeElement).toBe(link);
  });

  it("announces a new lesson once", async () => {
    await mount();
    await advance(500);
    expect(screen.getByTestId("announcer").textContent).toBe("");
    s.rows = [...s.rows, mkRow("L7")];
    s.rollup = { ...s.rollup, draft: 2 };
    await advance(2100);
    await advance(300);
    expect(screen.getByTestId("announcer").textContent).toBe("Lesson 7 is ready");
  });

  it("no minutes next to reviewer names", async () => {
    await mount();
    for (const tr of document.querySelectorAll("tbody tr")) expect(tr.textContent).not.toMatch(/\d+\s*min/i);
    expect(screen.getByText("Reviewer B (demo)").closest("tr")!.textContent).not.toMatch(/\bmin(utes)?\b/i);
  });
});
