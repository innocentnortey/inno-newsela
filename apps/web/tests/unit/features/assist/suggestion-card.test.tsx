import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuggestionCard } from "@/features/assist/suggestion-card";

afterEach(cleanup);
const S = { selected_text: "Connection to Today's Learning", suggested_text: "How might a storyteller's voice change a story?" };

describe("SuggestionCard", () => {
  it("renders the rewrite and the quoted text", () => {
    render(<SuggestionCard suggestion={S} busy={false} onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getByText(S.suggested_text)).toBeInTheDocument();
    expect(screen.getByText(S.selected_text).tagName).toBe("BLOCKQUOTE");
  });
  it("a script tag in the rewrite shows as text", () => {
    const evil = "<script>alert(1)</script>Hi";
    const { container } = render(<SuggestionCard suggestion={{ ...S, suggested_text: evil }} busy={false} onAccept={() => {}} onReject={() => {}} />);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(evil)).toBeInTheDocument();
  });
  it("Accept and Reject call their handlers once", async () => {
    const a = vi.fn();
    const r = vi.fn();
    render(<SuggestionCard suggestion={S} busy={false} onAccept={a} onReject={r} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(r).toHaveBeenCalledTimes(1);
  });
  it("both buttons are disabled while busy", () => {
    render(<SuggestionCard suggestion={S} busy onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getByRole("button", { name: "Accept" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Reject" })).toHaveAttribute("aria-disabled", "true");
  });
  it("no sparkle glyph", () => {
    const { container } = render(<SuggestionCard suggestion={S} busy={false} onAccept={() => {}} onReject={() => {}} />);
    expect(container.querySelector("svg[data-glyph=sparkle]")).toBeNull();
    expect(container.textContent).not.toMatch(/sparkle|✨/i);
  });
});
