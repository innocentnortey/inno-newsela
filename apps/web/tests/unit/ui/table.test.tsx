import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
afterEach(cleanup);

import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

describe("Table", () => {
  it("has a caption, column scopes, aria-sort and tabular numeric cells", () => {
    render(
      <Table caption="Lessons">
        <Thead>
          <Tr>
            <Th sort="ascending">Title</Th>
            <Th numeric>Words</Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Td>One</Td>
            <Td numeric>120</Td>
          </Tr>
        </Tbody>
      </Table>,
    );
    expect(screen.getByRole("table", { name: "Lessons" })).toBeInTheDocument();
    const th = screen.getAllByRole("columnheader");
    th.forEach((h) => expect(h).toHaveAttribute("scope", "col"));
    expect(th[0]).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByText("120")).toHaveClass("tabular-nums");
  });
  it("can hide the caption visually", () => {
    render(<Table caption="Hidden" captionHidden><Tbody /></Table>);
    expect(screen.getByText("Hidden")).toHaveClass("sr-only");
  });
});
