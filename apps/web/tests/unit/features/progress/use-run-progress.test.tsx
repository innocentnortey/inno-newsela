import { useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { useRunProgress } from "@/features/progress/use-run-progress";
import { progress, tile } from "./fixtures";

const GET = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a) },
}));

let last: ReturnType<typeof useRunProgress>;
function Probe() {
  const r = useRunProgress("run-0001");
  useEffect(() => {
    last = r;
  });
  return null;
}
const running = progress("running", [tile(1, "drafting")]);
const advance = (ms: number) =>
  act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const apiError = (code: "SERVICE_BUSY" | "NOT_FOUND", status = 503) =>
  new ApiError({ status, code, message: "x" });

beforeEach(() => {
  vi.useFakeTimers();
  GET.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useRunProgress", () => {
  it("requests at 0, 2 and 4 s while healthy", async () => {
    GET.mockResolvedValue({ data: running });
    render(<Probe />);
    await advance(0);
    await advance(2000);
    await advance(2000);
    expect(GET).toHaveBeenCalledTimes(3);
    expect(last.data?.state).toBe("running");
  });
  it("backs off 4, 8, 10 s after failures and resets on success", async () => {
    GET.mockResolvedValueOnce({ data: running }).mockRejectedValue(
      apiError("SERVICE_BUSY"),
    );
    render(<Probe />);
    await advance(0); // success
    await advance(2000); // failure 1 -> next request >= 4 s later
    expect(GET).toHaveBeenCalledTimes(2);
    await advance(2000); // tick, skipped
    expect(GET).toHaveBeenCalledTimes(2);
    await advance(2000); // tick at +6 s after failure... request allowed (>= 4 s)
    expect(GET).toHaveBeenCalledTimes(3);
    await advance(6000); // gap 8 s not reached yet
    expect(GET).toHaveBeenCalledTimes(3);
    await advance(2000);
    expect(GET).toHaveBeenCalledTimes(4);
    GET.mockResolvedValue({ data: running });
    await advance(10000);
    expect(GET.mock.calls.length).toBeGreaterThanOrEqual(5);
    const n = GET.mock.calls.length;
    await advance(2000);
    expect(GET).toHaveBeenCalledTimes(n + 1);
  });
  it("stops after unmount", async () => {
    GET.mockResolvedValue({ data: running });
    const { unmount } = render(<Probe />);
    await advance(2000);
    unmount();
    const n = GET.mock.calls.length;
    await advance(30000);
    expect(GET).toHaveBeenCalledTimes(n);
  });
  it("NOT_FOUND sets notFound and stops", async () => {
    GET.mockRejectedValue(apiError("NOT_FOUND", 404));
    render(<Probe />);
    await advance(0);
    expect(last.notFound).toBe(true);
    await advance(30000);
    expect(GET).toHaveBeenCalledTimes(1);
  });
  it("stops polling once complete", async () => {
    GET.mockResolvedValue({ data: progress("complete", [tile(1, "ready")]) });
    render(<Probe />);
    await advance(0);
    await advance(30000);
    expect(GET).toHaveBeenCalledTimes(1);
    expect(last.data?.state).toBe("complete");
  });
});
