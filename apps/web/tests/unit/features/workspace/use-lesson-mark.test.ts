// NL-100 (WF-8 / M-18): useLesson sets one "lesson-open" performance mark when the lesson content is ready, and none while it loads or fails.
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLesson } from "@/features/workspace/use-lesson";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: get },
}));

beforeEach(() => {
  performance.clearMarks("lesson-open");
  get.mockReset();
});

describe("useLesson lesson-open mark", () => {
  it("marks once when the lesson is ready", async () => {
    get.mockResolvedValue({ data: { lesson_id: "G6.U4.L4" } });
    const { result } = renderHook(() => useLesson("G6.U4.L4"));
    expect(performance.getEntriesByName("lesson-open")).toHaveLength(0);
    await waitFor(() => expect(result.current.load.kind).toBe("ready"));
    const marks = performance.getEntriesByName("lesson-open");
    expect(marks).toHaveLength(1);
    expect((marks[0] as PerformanceMark).detail).toEqual({
      lesson_id: "G6.U4.L4",
    });
  });

  it("does not mark when the lesson cannot be opened", async () => {
    get.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useLesson("G6.U4.L4"));
    await waitFor(() => expect(result.current.load.kind).toBe("error"));
    expect(performance.getEntriesByName("lesson-open")).toHaveLength(0);
  });
});
