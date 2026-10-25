import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { showToast } from "@/features/send-back/toast-host";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("toast host", () => {
  it("showToast renders in the body and survives the caller", async () => {
    await act(async () => showToast("Sent back to J. Rivera."));
    expect(document.body.textContent).toContain("Sent back to J. Rivera.");
    expect(document.querySelector("[role=status]")).not.toBeNull();
  });
  it("a second toast replaces the first", async () => {
    await act(async () => showToast("first"));
    await act(async () => showToast("second"));
    expect(document.body.textContent).toContain("second");
    expect(document.body.textContent).not.toContain("first");
    expect(document.querySelectorAll("[role=status]")).toHaveLength(1);
  });
  it("dismisses after the duration", async () => {
    vi.useFakeTimers();
    await act(async () => showToast("brief", 50));
    expect(document.body.textContent).toContain("brief");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(document.body.textContent).not.toContain("brief");
  });
});
