import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { Breadcrumb, PageHeader } from "@/components/layout";

describe("Breadcrumb", () => {
  it("marks the last crumb current and not a link", () => {
    render(
      <Breadcrumb
        items={[{ label: "Units", href: "/u" }, { label: "Unit 1", href: "/u/1" }, { label: "Lesson 4" }]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(2);
    links.forEach((l) => expect(l).not.toHaveAttribute("aria-current"));
    const last = within(nav).getByText("Lesson 4");
    expect(last).toHaveAttribute("aria-current", "page");
    expect(last.closest("a")).toBeNull();
  });

  it("handles a single item", () => {
    render(<Breadcrumb items={[{ label: "Home", href: "/" }]} />);
    expect(screen.getByText("Home")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("PageHeader", () => {
  it("renders title, eyebrow, meta and actions", () => {
    render(
      <PageHeader
        eyebrow="Unit 2"
        title="Lesson 4"
        meta={<span>Draft</span>}
        actions={<button type="button">Approve</button>}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Lesson 4" })).toBeInTheDocument();
    expect(screen.getByText("Unit 2")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("omits the actions wrapper when none given", () => {
    const { container } = render(<PageHeader title="T" />);
    expect(container.querySelector('[data-slot="actions"]')).toBeNull();
  });
});
