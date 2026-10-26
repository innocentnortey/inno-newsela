import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { SideRail, TwoPane } from "@/components/layout";

describe("TwoPane", () => {
  it("puts content before the rail and names the rail landmark", () => {
    render(
      <TwoPane rail={<SideRail title="Evidence">r</SideRail>}>
        <p>Content</p>
      </TwoPane>,
    );
    const content = screen.getByText("Content");
    const rail = screen.getByRole("complementary", { name: "Evidence" });
    expect(content.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("records rail width and the lg breakpoint", () => {
    const { container, rerender } = render(
      <TwoPane rail={<span>r</span>}>
        <p>c</p>
      </TwoPane>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-rail-width", "rail");
    expect(root.className).toContain("lg:grid-cols");
    rerender(
      <TwoPane rail={<span>r</span>} railWidth="rail-narrow">
        <p>c</p>
      </TwoPane>,
    );
    expect(container.firstElementChild).toHaveAttribute("data-rail-width", "rail-narrow");
  });

  it("mobile grid has a single shrinkable column", () => {
    const { container } = render(
      <TwoPane rail={<span>r</span>}>
        <p>c</p>
      </TwoPane>,
    );
    expect((container.firstElementChild as HTMLElement).className).toMatch(/(^|\s)grid-cols-1(\s|$)/);
    expect(container.querySelector('[data-slot="content"]')).toHaveClass("min-w-0");
    expect(container.querySelector('[data-slot="rail"]')).toHaveClass("min-w-0");
  });
});
