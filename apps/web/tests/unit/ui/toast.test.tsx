import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
afterEach(cleanup);

import { Toast } from "@/components/ui/toast";

describe("Toast", () => {
  it("is a polite status and fires its action", async () => {
    const onAction = vi.fn();
    render(<Toast message="Quote inserted." action={{ label: "Undo", onAction }} />);
    const t = screen.getByRole("status");
    expect(t).toHaveAttribute("aria-live", "polite");
    await userEvent.setup().click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledOnce();
  });
  it("auto-dismisses after 6000 ms", () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<Toast message="m" onDismiss={onDismiss} />);
      act(() => {
        vi.advanceTimersByTime(5999);
      });
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onDismiss).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
  it("hover pauses the timer", () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<Toast message="m" onDismiss={onDismiss} />);
      act(() => {
        screen.getByRole("status").dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      });
      act(() => {
        vi.advanceTimersByTime(7000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
