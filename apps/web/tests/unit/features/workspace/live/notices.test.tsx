import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DisconnectedBanner, RefusedNotice, SignedOutNotice, refused_reason_phrase } from "@/features/workspace/live/notices";

afterEach(cleanup);

describe("notices", () => {
  it("DisconnectedBanner shows the exact sentence", () => {
    render(<DisconnectedBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("Reconnecting: your last edits are not saved yet. Submit is off until they are.");
  });
  it("RefusedNotice is an alert with the exact title and plain-text removed text", () => {
    const { container } = render(<RefusedNotice lesson_label="Lesson 4" reason_phrase="was submitted" removed_text={["<b>x</b>"]} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Your last edits were not saved because Lesson 4 was submitted. They have been removed from your view.");
    expect(alert).toHaveTextContent("Removed text: “<b>x</b>”");
    expect(container.querySelector("b")).toBeNull();
  });
  it("RefusedNotice omits the removed-text line when empty", () => {
    render(<RefusedNotice lesson_label="Lesson 4" reason_phrase="is locked" removed_text={[" "]} />);
    expect(screen.getByRole("alert")).not.toHaveTextContent("Removed text");
  });
  it("SignedOutNotice links to sign in", () => {
    render(<SignedOutNotice signInHref="/sign-in?next=%2Fx" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in?next=%2Fx");
  });
  it("refused_reason_phrase", () => {
    expect(refused_reason_phrase("submitted")).toBe("was submitted");
    expect(refused_reason_phrase("approved")).toBe("was approved");
    expect(refused_reason_phrase("exported")).toBe("was approved");
    expect(refused_reason_phrase(null)).toBe("is locked");
  });
});
