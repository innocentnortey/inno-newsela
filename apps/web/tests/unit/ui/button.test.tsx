import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
afterEach(cleanup);

import { readFileSync } from "node:fs";
import path from "node:path";
import { Button, INDICATOR_DELAY_MS } from "@/components/ui/button";
import { ratio } from "../tokens/contrast";
import { declarations, findBlock } from "../tokens/css";

const css = readFileSync(path.resolve(__dirname, "../../../src/styles/tokens.css"), "utf8");
const light = declarations(findBlock(css, "@theme static")!.body);
const dark = new Map([...light, ...declarations(findBlock(css, '[data-theme="dark"]')!.body)]);

describe("Button tokens", () => {
  it.each([
    ["light", light],
    ["dark", dark],
  ])("on-primary on primary is at least 4.5:1 (%s)", (_n, t) => {
    expect(ratio(t.get("--color-on-primary")!, t.get("--color-primary")!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each([
    ["light", light],
    ["dark", dark],
  ])("focus ring on panel is at least 3:1 (%s)", (_n, t) => {
    expect(ratio(t.get("--color-focus")!, t.get("--color-panel")!)).toBeGreaterThanOrEqual(3);
  });
});

describe("Button", () => {
  it("is a button with default type=button", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });
  it("sizes", () => {
    render(
      <>
        <Button size="sm">S</Button>
        <Button>M</Button>
        <Button size="lg">L</Button>
      </>,
    );
    expect(screen.getByText("S").closest("button")).toHaveClass("h-7");
    expect(screen.getByText("M").closest("button")).toHaveClass("h-9");
    expect(screen.getByText("L").closest("button")).toHaveClass("h-11");
  });
  it("disabled is aria-disabled, focusable, shows its reason and ignores clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled disabledReason="Generate stays off: 5 errors to confirm" onClick={onClick}>
        Generate
      </Button>,
    );
    const b = screen.getByRole("button", { name: /Generate/ });
    expect(b).toHaveAttribute("aria-disabled", "true");
    expect(b).not.toHaveAttribute("disabled");
    const reason = screen.getByText("Generate stays off: 5 errors to confirm");
    expect(reason).toBeVisible();
    expect(b).toHaveAttribute("aria-describedby", reason.id);
    await userEvent.setup().click(b);
    b.focus();
    expect(b).toHaveFocus();
    expect(onClick).not.toHaveBeenCalled();
  });
  it("Enter and Space activate", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });
  it("loading keeps its label, is busy, ignores clicks and shows the spinner only after the delay", () => {
    vi.useFakeTimers();
    try {
      const onClick = vi.fn();
      const { container } = render(
        <Button loading onClick={onClick}>
          Save
        </Button>,
      );
      const b = screen.getByRole("button", { name: "Save" });
      expect(b).toHaveAttribute("aria-busy", "true");
      expect(container.querySelector("[data-spinner]")).toBeNull();
      act(() => {
        vi.advanceTimersByTime(INDICATOR_DELAY_MS);
      });
      expect(container.querySelector("[data-spinner]")).not.toBeNull();
      act(() => b.click());
      expect(onClick).not.toHaveBeenCalled();
      expect(b).toHaveTextContent("Save");
    } finally {
      vi.useRealTimers();
    }
  });
});
