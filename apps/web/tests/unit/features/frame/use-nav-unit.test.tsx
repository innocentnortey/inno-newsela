import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A plain function, not vi.fn: vitest tracks a vi.fn's returned promise and reports a rejection as unhandled.
const calls: unknown[][] = [];
let impl: () => Promise<unknown> = async () => ({ data: { units: [] } });
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => (calls.push(a), impl()) },
}));

const units = [
  { unit_key: "g6-u4", versions: [{ created_at: "2026-10-01T00:00:00Z" }], latest_run: null },
  { unit_key: "g7-u2", versions: [{ created_at: "2026-10-20T00:00:00Z" }], latest_run: null },
];

async function load() {
  vi.resetModules();
  return (await import("@/features/frame/use-nav-unit")).useNavUnitKey;
}

beforeEach(() => {
  calls.length = 0;
});
afterEach(cleanup);

describe("useNavUnitKey", () => {
  it("takes the key from the path and makes no request", async () => {
    const useNavUnitKey = await load();
    const { result } = renderHook(() => useNavUnitKey("/units/g6-u4/board"));
    expect(result.current).toBe("g6-u4");
    expect(calls).toHaveLength(0);
  });
  it("on /units requests the list once and returns the most recent unit", async () => {
    impl = async () => ({ data: { units } });
    const useNavUnitKey = await load();
    const { result } = renderHook(() => useNavUnitKey("/units"));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe("g7-u2"));
    expect(calls).toEqual([["/units"]]);
  });
  it("returns null when the request fails", async () => {
    impl = async () => {
      throw new Error("down");
    };
    const useNavUnitKey = await load();
    const { result } = renderHook(() => useNavUnitKey("/units"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(calls).toHaveLength(1);
    expect(result.current).toBeNull();
  });
  it("remembers the last unit seen on a later page outside any unit", async () => {
    const useNavUnitKey = await load();
    const { result, rerender } = renderHook(({ p }) => useNavUnitKey(p), { initialProps: { p: "/units/g6-u4/board" } });
    impl = async () => ({ data: { units } });
    rerender({ p: "/prompt-guidance" });
    expect(result.current).toBe("g6-u4");
  });
});
