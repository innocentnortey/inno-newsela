import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../../../app/page";

describe("placeholder page", () => {
  it("renders the foundation heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Lesson Studio — foundation" }),
    ).toBeInTheDocument();
  });
});
