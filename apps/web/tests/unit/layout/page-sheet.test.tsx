import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { PageSheet } from "@/components/layout";

describe("PageSheet", () => {
  it("wraps children in a 68ch reading column and shows the toolbar", () => {
    const { container } = render(
      <PageSheet toolbar={<span>Tools</span>}>
        <p>Lesson text</p>
      </PageSheet>,
    );
    const col = container.querySelector('[data-slot="reading-column"]') as HTMLElement;
    expect(col.className).toContain("max-w-[68ch]");
    expect(col).toContainElement(screen.getByText("Lesson text"));
    expect(screen.getByText("Tools")).toBeInTheDocument();
  });

  it("omits the toolbar when absent", () => {
    const { container } = render(<PageSheet>x</PageSheet>);
    expect(container.querySelector('[data-slot="toolbar"]')).toBeNull();
  });
});
