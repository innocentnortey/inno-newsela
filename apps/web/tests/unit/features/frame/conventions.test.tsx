import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, afterEach } from "vitest";
import { CantLoad, DisabledReason, ForbiddenBanner, NotFound, RoleNote, StaleBanner } from "@/features/frame/conventions";

afterEach(cleanup);

describe("screen conventions", () => {
  it("CantLoad says what failed and retries", async () => {
    const onRetry = vi.fn();
    render(<CantLoad thing="the board" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the board. Check your connection and try again.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
  it("NotFound names the place and links back", () => {
    render(<NotFound what="lesson L99" where="Grade 6 · Unit 4" boardHref="/units/g6-u4/board" />);
    expect(screen.getByText("There is no lesson L99 in Grade 6 · Unit 4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the board" })).toHaveAttribute("href", "/units/g6-u4/board");
  });
  it("StaleBanner shows the time of the last good data", () => {
    render(<StaleBanner asOf={new Date(2026, 9, 25, 10, 42)} />);
    expect(screen.getByText("Live updates paused. Showing the board as of 10:42. Retrying…")).toBeInTheDocument();
  });
  it("ForbiddenBanner shows the server message verbatim", () => {
    render(<ForbiddenBanner message="Only reviewers can do that." />);
    expect(screen.getByText("Only reviewers can do that.")).toBeInTheDocument();
  });
  it("RoleNote and DisabledReason render their text", () => {
    render(<><RoleNote>Only authors upload.</RoleNote><DisabledReason id="why">Not now.</DisabledReason></>);
    expect(screen.getByText("Only authors upload.")).toBeInTheDocument();
    expect(screen.getByText("Not now.")).toHaveAttribute("id", "why");
  });
});
