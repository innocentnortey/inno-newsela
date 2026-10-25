import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
afterEach(cleanup);

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function setup() {
  render(
    <Tabs defaultValue="issues">
      <TabsList aria-label="Evidence">
        <TabsTrigger value="issues" count={3}>Issues</TabsTrigger>
        <TabsTrigger value="standards">Standards</TabsTrigger>
        <TabsTrigger value="outline">Outline row</TabsTrigger>
      </TabsList>
      <TabsContent value="issues">A</TabsContent>
      <TabsContent value="standards">B</TabsContent>
      <TabsContent value="outline">C</TabsContent>
    </Tabs>,
  );
}

describe("Tabs", () => {
  it("has a tablist with three tabs, first selected, roving tabindex, count", () => {
    setup();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    expect(tabs[2]).toHaveAttribute("tabindex", "-1");
    expect(tabs[0]).toHaveTextContent("Issues3");
  });
  it("arrow keys, Home and End move focus and selection", async () => {
    const user = userEvent.setup();
    setup();
    const tabs = screen.getAllByRole("tab");
    await user.tab();
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(tabs[2]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveFocus();
  });
});
