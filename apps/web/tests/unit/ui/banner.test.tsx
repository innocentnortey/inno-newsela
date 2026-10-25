import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
afterEach(cleanup);

import { Banner, type BannerLevel } from "@/components/ui/banner";

const words: Record<BannerLevel, string> = { blocking: "Blocking", advisory: "Advisory", info: "Info", success: "Success" };

describe("Banner", () => {
  it("blocking is an alert", () => {
    render(<Banner level="blocking" title="5 errors to confirm" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it.each(["advisory", "info", "success"] as const)("%s is a status, not an alert", (level) => {
    render(<Banner level={level} title="T" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it.each(Object.keys(words) as BannerLevel[])("%s shows an icon and its level word", (level) => {
    const { container } = render(<Banner level={level} title="T" />);
    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByText(words[level])).toBeInTheDocument();
  });
  it("renders body and action", () => {
    render(
      <Banner level="info" title="T" action={<button>Reload</button>}>
        Body text
      </Banner>,
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });
});
