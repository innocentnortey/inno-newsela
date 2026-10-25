import { useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { useUnitPlan } from "@/features/unit-plan/use-unit-plan";

const GET = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a) },
}));

let last: ReturnType<typeof useUnitPlan>;
function Probe() {
  const r = useUnitPlan("run-0001");
  useEffect(() => {
    last = r;
  });
  return null;
}
const plan = (state: "planning" | "stored") => ({
  run_id: "run-0001",
  state,
  stored_at: null,
  entries: [],
  lesson_links: [],
});
const advance = (ms: number) =>
  act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
// Step by one interval so React re-renders (and tears the poll down) between ticks.
const steps = async (n: number) => {
  for (let i = 0; i < n; i++) await advance(2000);
};

beforeEach(() => {
  vi.useFakeTimers();
  GET.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useUnitPlan", () => {
  it("polls while planning and stops once stored", async () => {
    GET.mockResolvedValueOnce({ data: plan("planning") })
      .mockResolvedValueOnce({ data: plan("planning") })
      .mockResolvedValue({ data: plan("stored") });
    render(<Probe />);
    await advance(0);
    await advance(2000);
    await advance(2000);
    expect(GET).toHaveBeenCalledTimes(3);
    await steps(15);
    expect(GET).toHaveBeenCalledTimes(3);
    expect(last.data?.state).toBe("stored");
  });
  it("makes one request when the first read is stored", async () => {
    GET.mockResolvedValue({ data: plan("stored") });
    render(<Probe />);
    await advance(0);
    await steps(15);
    expect(GET).toHaveBeenCalledTimes(1);
  });
  it("stops on NOT_FOUND", async () => {
    GET.mockRejectedValue(
      new ApiError({ status: 404, code: "NOT_FOUND", message: "x" }),
    );
    render(<Probe />);
    await advance(0);
    expect(last.notFound).toBe(true);
    const n = GET.mock.calls.length;
    await steps(15);
    expect(GET).toHaveBeenCalledTimes(n);
  });
  it("keeps polling after another error and clears it on success", async () => {
    GET.mockRejectedValueOnce(
      new ApiError({ status: 503, code: "SERVICE_BUSY", message: "x" }),
    ).mockResolvedValue({
      data: plan("planning"),
    });
    render(<Probe />);
    await advance(0);
    expect(last.error).toBeTruthy();
    await advance(2000);
    expect(last.error).toBeFalsy();
    expect(last.data?.state).toBe("planning");
  });
  it("stops after unmount", async () => {
    GET.mockResolvedValue({ data: plan("planning") });
    const { unmount } = render(<Probe />);
    await advance(0);
    unmount();
    const n = GET.mock.calls.length;
    await advance(10000);
    expect(GET).toHaveBeenCalledTimes(n);
  });
});
