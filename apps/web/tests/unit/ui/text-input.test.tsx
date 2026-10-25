import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
afterEach(cleanup);

import { TextInput, Textarea } from "@/components/ui/text-input";

describe.each([
  ["TextInput", TextInput],
  ["Textarea", Textarea],
] as const)("%s", (_n, C) => {
  it("is labelled", () => {
    render(<C label="Quote" />);
    expect(screen.getByLabelText("Quote")).toBeInTheDocument();
  });
  it("wires help and error into aria-describedby and sets aria-invalid only with error", () => {
    const { rerender } = render(<C label="Quote" help="Max 12 words" />);
    const el = screen.getByLabelText("Quote");
    expect(el).not.toHaveAttribute("aria-invalid");
    expect(el).toHaveAccessibleDescription("Max 12 words");
    rerender(<C label="Quote" help="Max 12 words" error="Add the book and page" />);
    expect(el).toHaveAttribute("aria-invalid", "true");
    expect(el).toHaveAccessibleDescription("Max 12 words Add the book and page");
  });
  it("passes disabled and readOnly through", () => {
    render(<C label="A" disabled />);
    render(<C label="B" readOnly />);
    expect(screen.getByLabelText("A")).toBeDisabled();
    expect(screen.getByLabelText("B")).toHaveAttribute("readonly");
  });
});
