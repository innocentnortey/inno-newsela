import { useEffect, useState } from "react";
import { act, render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePoll, type UsePollResult } from "@/lib/use-poll";

let last: UsePollResult<number>;
function Probe({ fetcher }: { fetcher: () => Promise<number> }) {
  const result = usePoll(fetcher);
  useEffect(() => {
    last = result;
  });
  return <button>focus me</button>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

afterEach(cleanup);

describe("usePoll", () => {
  it("polls every 2 s and keeps data through a failure until 10 s have passed", async () => {
    let n = 0;
    let fail = false;
    const fetcher = vi.fn(async () => {
      if (fail) throw new Error("down");
      return ++n;
    });
    const { container } = render(<Probe fetcher={fetcher} />);
    const button = container.querySelector("button")!;
    button.focus();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(last.data).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(last.data).toBe(2);
    const at = last.dataAt;
    fail = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(last.error).toBeInstanceOf(Error);
    expect(last.stale).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(last.stale).toBe(true);
    expect(last.data).toBe(2);
    expect(last.dataAt).toBe(at);
    expect(document.activeElement).toBe(button);
    fail = false;
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(last.stale).toBe(false);
    expect(last.data).toBe(3);
  });

  it("stops polling on unmount", async () => {
    const fetcher = vi.fn(async () => 1);
    const { unmount } = render(<Probe fetcher={fetcher} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    unmount();
    const calls = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetcher.mock.calls.length).toBe(calls);
  });

  it("retry fetches now", async () => {
    const fetcher = vi.fn(async () => 1);
    render(<Probe fetcher={fetcher} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const before = fetcher.mock.calls.length;
    await act(async () => { last.retry(); await vi.advanceTimersByTimeAsync(0); });
    expect(fetcher.mock.calls.length).toBe(before + 1);
  });

  it("still delivers data when the fetch itself turns polling off before it resolves", async () => {
    // A fetcher that flips `enabled` to false (a terminal run state) and returns: the data must not be dropped.
    function Toggling() {
      const [enabled, set] = useState(true);
      const result = usePoll(
        async () => {
          set(false);
          await Promise.resolve();
          await Promise.resolve();
          return 7;
        },
        { enabled },
      );
      useEffect(() => {
        last = result;
      });
      return null;
    }
    render(<Toggling />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(last.data).toBe(7);
  });
});
