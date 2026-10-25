import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FrozenText } from "@/features/approval/frozen-text";
import type { components } from "@/lib/api-types";

afterEach(cleanup);
const sec = (content: unknown[]): components["schemas"]["Section"] => ({
  address: "G6.U4.L5.Launch", name: "Launch", minutes: 5, content: { type: "doc", content } as never,
});
const text = (t: string) => ({ type: "text", text: t });

describe("FrozenText", () => {
  it("renders hostile strings as text", () => {
    const { container } = render(
      <FrozenText sections={[sec([{ type: "paragraph", content: [text("<img src=x onerror=alert(1)>")] }, { type: "paragraph", content: [text("<script>alert(1)</script>")] }])]} />,
    );
    expect(container.querySelector("img, script")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });

  it("heading levels stay in order below h2", () => {
    render(<FrozenText sections={[sec([1, 4, 6].map((level) => ({ type: "heading", attrs: { level }, content: [text(`H${level}`)] })))]} />);
    expect(screen.getByText("H1").closest("h3,h4,h5,h6")!.tagName).toBe("H3");
    expect(screen.getByText("H4").closest("h3,h4,h5,h6")!.tagName).toBe("H6");
    expect(screen.getByText("H6").closest("h3,h4,h5,h6")!.tagName).toBe("H6");
  });

  it("unknown node types render their children only", () => {
    const { container } = render(<FrozenText sections={[sec([{ type: "teacher_tip", attrs: { href: "javascript:alert(1)" }, content: [{ type: "paragraph", content: [text("Tip body")] }] }])]} />);
    expect(screen.getByText("Tip body")).toBeInTheDocument();
    expect(container.querySelector("a, [href]")).toBeNull();
  });
});
