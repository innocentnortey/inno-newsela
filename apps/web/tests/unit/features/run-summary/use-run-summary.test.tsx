import { useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { useRunSummary } from "@/features/run-summary/use-run-summary";

const GET = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a) },
}));

let last: ReturnType<typeof useRunSummary>;
function Probe() {
  const r = useRunSummary("run-0001");
  useEffect(() => {
    last = r;
  });
  return null;
}

const body = (state: string) => ({ data: { run_id: "run-0001", state } });
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  GET.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useRunSummary", () => {
  it("polls a running run every 2 s", async () => {
    GET.mockResolvedValue(body("running"));
    render(<Probe />);
    await tick(0);
    expect(GET).toHaveBeenCalledTimes(1);
    await tick(2000);
    expect(GET).toHaveBeenCalledTimes(2);
    await tick(2000);
    expect(GET).toHaveBeenCalledTimes(3);
  });
  it("stops once the run is finished", async () => {
    GET.mockResolvedValueOnce(body("running")).mockResolvedValue(
      body("complete"),
    );
    render(<Probe />);
    await tick(0);
    await tick(2000);
    const n = GET.mock.calls.length;
    await tick(30000);
    expect(GET).toHaveBeenCalledTimes(n);
    expect(last.data?.state).toBe("complete");
  });
  it("stops on NOT_FOUND", async () => {
    GET.mockRejectedValue(
      new ApiError({ status: 404, code: "NOT_FOUND", message: "x" }),
    );
    render(<Probe />);
    await tick(0);
    expect(last.notFound).toBe(true);
    const n = GET.mock.calls.length;
    await tick(30000);
    expect(GET).toHaveBeenCalledTimes(n);
  });
  it("stops after unmount", async () => {
    GET.mockResolvedValue(body("running"));
    const { unmount } = render(<Probe />);
    await tick(2000);
    unmount();
    const n = GET.mock.calls.length;
    await tick(10000);
    expect(GET).toHaveBeenCalledTimes(n);
  });
});
