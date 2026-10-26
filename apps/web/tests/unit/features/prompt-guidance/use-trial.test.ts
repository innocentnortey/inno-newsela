import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrial } from "@/features/prompt-guidance/use-trial";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: h.get, POST: h.post },
}));
vi.mock("@/features/board/data", () => ({
  fetchBoard: vi.fn().mockResolvedValue({ board: { rows: [{ lesson_id: "G6.U4.L4", lesson_key: "L4", number: 4, title: "Lesson 4: Voice" }] } }),
}));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  h.get.mockReset().mockImplementation(async (path: string) =>
    path === "/units"
      ? { data: { units: [{ unit_key: "g6-u4", versions: [{ version_number: 1, outline_version_id: "ov1" }] }] } }
      : { data: { versions: [{ version_id: "lv-9", kind: "candidate", provenance: { run_id: "run-77" } }] } },
  );
  h.post.mockReset().mockResolvedValue({ data: { run_id: "run-77", state: "planning" } });
});
afterEach(() => vi.useRealTimers());

describe("useTrial", () => {
  // The candidate route is keyed by run id (CON-16), so the link must carry the run id, not the lesson version id found in the history.
  it("addresses the made candidate by its run id", async () => {
    const { result } = renderHook(() => useTrial({ promptVersionId: "pv-1", onForbidden: () => undefined }));
    await waitFor(() => expect(result.current.lessons).toBeDefined());
    act(() => result.current.setLessonId("G6.U4.L4"));
    await act(async () => {
      const done = result.current.start();
      await vi.advanceTimersByTimeAsync(2500);
      await done;
    });
    expect(result.current.result).toEqual({ kind: "made", number: 4, lessonKey: "L4", candidateId: "run-77" });
  });
});
