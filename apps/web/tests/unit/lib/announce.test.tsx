import { act, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnounceProvider, useAnnounce } from "@/lib/announce";

function Speak({ msgs }: { msgs: string[] }) {
  const say = useAnnounce();
  return <button onClick={() => msgs.forEach(say)}>go</button>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

afterEach(cleanup);

describe("announce", () => {
  it("debounces a burst to the last message in one polite region", () => {
    render(<AnnounceProvider><Speak msgs={["a", "b", "c"]} /></AnnounceProvider>);
    act(() => screen.getByText("go").click());
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("");
    act(() => { vi.advanceTimersByTime(150); });
    expect(region).toHaveTextContent("c");
  });
});
