import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
afterEach(cleanup);

import { Stepper } from "@/components/ui/stepper";

describe("Stepper", () => {
  it("marks exactly one current step, reads Step 2 of 5, In review", () => {
    const { container } = render(<Stepper current={2} />);
    const cur = container.querySelectorAll("[aria-current='step']");
    expect(cur).toHaveLength(1);
    expect(cur[0].textContent).toMatch(/Step 2 of 5, In review/);
    expect(cur[0].textContent).toContain("In review");
  });
  it("is an ordered list of five steps in order, not interactive", () => {
    const { container } = render(<Stepper current={2} />);
    expect(screen.getByRole("list", { name: "Lesson progress" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    ["Draft", "In review", "Submitted", "Approved", "Exported"].forEach((l, i) => expect(items[i]).toHaveTextContent(l));
    expect(container.querySelectorAll("button, a, [tabindex]")).toHaveLength(0);
  });
  it("shows the off-path pill slot", () => {
    render(<Stepper current={2} offPath={<span>Changes requested</span>} />);
    expect(screen.getByText("Changes requested")).toBeInTheDocument();
  });
});
