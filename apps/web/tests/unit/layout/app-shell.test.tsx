import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { AppShell, type NavSection } from "@/components/layout";

const sections: NavSection[] = [
  {
    id: "a",
    label: "Work",
    items: [
      { id: "d", label: "Drafts", href: "/drafts", count: 3, current: true },
      { id: "r", label: "Review", href: "/review", count: 0 },
    ],
  },
  { id: "b", items: [{ id: "s", label: "Settings", href: "/settings" }] },
];

describe("AppShell", () => {
  it("makes the skip link first tabbable and targets main", async () => {
    render(
      <AppShell navSections={sections} topBar={<span>Top</span>}>
        <p>Body</p>
      </AppShell>,
    );
    await userEvent.tab();
    const skip = screen.getByRole("link", { name: /skip to main content/i });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(document.getElementById("main-content")).toBe(screen.getByRole("main"));
  });

  it("exposes landmarks, current item and counts", () => {
    render(
      <AppShell navSections={sections}>
        <p>Body</p>
      </AppShell>,
    );
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    const drafts = screen.getByRole("link", { name: /Drafts.*3/ });
    expect(drafts).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Review.*0/ })).not.toHaveAttribute("aria-current");
  });

  it("toggles the mobile menu", async () => {
    render(
      <AppShell navSections={sections}>
        <p>Body</p>
      </AppShell>,
    );
    const btn = screen.getByRole("button", { name: "Menu" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("gives spare height to the content row, not the top bar row", () => {
    const { container } = render(
      <AppShell navSections={sections} topBar={<span>Top</span>}>
        <p>Body</p>
      </AppShell>,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain("md:grid-rows-[auto_1fr]");
  });
});
