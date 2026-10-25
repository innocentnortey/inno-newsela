import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
afterEach(cleanup);

import { Link } from "@/components/ui/link";

describe("Link", () => {
  it("is a link with href", () => {
    render(<Link href="/a">Go</Link>);
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/a");
  });
  it("external adds rel, target and a hidden arrow", () => {
    const { container } = render(<Link href="https://x.org" external>X</Link>);
    const a = screen.getByRole("link", { name: "X" });
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
    expect(a).toHaveAttribute("target", "_blank");
    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });
  it("inText is underlined", () => {
    render(<Link href="/a" inText>T</Link>);
    expect(screen.getByRole("link")).toHaveClass("underline");
  });
});
