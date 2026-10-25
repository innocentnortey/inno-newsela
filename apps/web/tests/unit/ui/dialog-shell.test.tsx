import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
afterEach(cleanup);

import { DialogShell } from "@/components/ui/dialog-shell";

function setup(busy = false) {
  render(
    <DialogShell
      trigger={<button>Open</button>}
      title="Delete lesson"
      description="This cannot be undone."
      busy={busy}
      footer={<button>Confirm</button>}
    >
      <input aria-label="Reason" />
    </DialogShell>,
  );
}

describe("DialogShell", () => {
  it("opens labelled by its title with the description wired", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Open" }));
    const d = screen.getByRole("dialog", { name: "Delete lesson" });
    expect(d).toHaveAccessibleDescription("This cannot be undone.");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });
  it("traps focus", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: "Open" }));
    const d = screen.getByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(d.contains(document.activeElement)).toBe(true);
    }
  });
  it("Escape closes and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
  it("busy ignores Escape", async () => {
    const user = userEvent.setup();
    setup(true);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
