import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
afterEach(cleanup);

import { Select } from "@/components/ui/select";

describe("Select", () => {
  it("is a named combobox and selects an option", async () => {
    render(<Select label="Grade" options={[{ value: "6", label: "Grade 6" }, { value: "7", label: "Grade 7" }]} />);
    const s = screen.getByRole("combobox", { name: "Grade" });
    await userEvent.setup().selectOptions(s, "7");
    expect(s).toHaveValue("7");
  });
  it("wires error", () => {
    render(<Select label="Grade" error="Pick one" options={[{ value: "6", label: "6" }]} />);
    const s = screen.getByRole("combobox", { name: "Grade" });
    expect(s).toHaveAttribute("aria-invalid", "true");
    expect(s).toHaveAccessibleDescription("Pick one");
  });
});
