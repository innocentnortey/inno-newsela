import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/features/frame/session-context";
import { useReviewHeartbeat } from "@/features/workspace/actions/use-review-heartbeat";
import { SESSIONS } from "@/test-utils/fixtures";
import type { Role } from "@/lib/roles";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: vi.fn(), POST: post },
}));

let visibility = "visible";
const wrap = (role: Role) =>
  function W({ children }: { children: ReactNode }) {
    return createElement(SessionProvider, { value: { user: SESSIONS[role].user, role } } as never, children);
  };
const mount = (role: Role = "reviewer") =>
  renderHook(() => useReviewHeartbeat({ lessonId: "G6.U4.L4", versionId: "lv-1" }), { wrapper: wrap(role) });

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  post.mockReset().mockResolvedValue({});
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useReviewHeartbeat", () => {
  it("posts every 15 s while open, focused and touched", async () => {
    mount();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(post).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(post).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("sends exactly the contract fields and no minutes", async () => {
    mount();
    await vi.advanceTimersByTimeAsync(15_000);
    const [path, init] = post.mock.calls[0]!;
    expect(path).toBe("/lessons/{lessonId}/heartbeats");
    expect(init.params).toEqual({ path: { lessonId: "G6.U4.L4" } });
    expect(Object.keys(init.body).sort()).toEqual(["focused", "last_input_at", "sent_at", "tab_id", "version_id", "visible"]);
    expect(init.body).toMatchObject({ focused: true, visible: true, version_id: "lv-1" });
    expect(init.body.tab_id).toMatch(/^tab-[0-9a-f]{8}$/);
  });

  it("stops while the tab is hidden and resumes when visible", async () => {
    mount();
    visibility = "hidden";
    await vi.advanceTimersByTimeAsync(15_000);
    expect(post).toHaveBeenCalledTimes(0);
    visibility = "visible";
    await vi.advanceTimersByTimeAsync(15_000);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("stops after 60 s without input and resumes on input", async () => {
    mount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(post).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(post).toHaveBeenCalledTimes(4);
    window.dispatchEvent(new Event("keydown"));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(post).toHaveBeenCalledTimes(5);
  });

  it("never posts for an author", async () => {
    mount("author");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(post).not.toHaveBeenCalled();
  });

  it("drops a failed post silently and keeps going", async () => {
    post.mockRejectedValue(new Error("down"));
    mount();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("stops on unmount", async () => {
    const { unmount } = mount();
    unmount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(post).not.toHaveBeenCalled();
  });

  it("sends nothing while disabled (lesson not ready), then starts once enabled", async () => {
    const { rerender } = renderHook(
      ({ enabled }) => useReviewHeartbeat({ lessonId: enabled ? "G6.U4.L4" : "", versionId: "lv-1", enabled }),
      { wrapper: wrap("reviewer"), initialProps: { enabled: false } },
    );
    await vi.advanceTimersByTimeAsync(45_000);
    expect(post).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]![1].params.path.lessonId).toBe("G6.U4.L4");
  });
});
