import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
afterEach(cleanup);

import { Checkbox, Radio, RadioCard, RadioGroup } from "@/components/ui/choice";

describe("choice controls", () => {
  it("checkbox toggles with Space", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Agree" />);
    await user.tab();
    await user.keyboard(" ");
    expect(screen.getByRole("checkbox", { name: "Agree" })).toBeChecked();
  });
  it("radio group has fieldset, legend, required text and arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup legend="Rating" required>
        <Radio name="r" label="Good" value="g" />
        <Radio name="r" label="Poor" value="p" />
      </RadioGroup>,
    );
    expect(screen.getByRole("group", { name: /Rating/ })).toBeInTheDocument();
    expect(screen.getByText("(required)")).toBeInTheDocument();
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Poor" })).toBeChecked();
  });
  it("radio card selects when its label is clicked", async () => {
    render(<RadioCard name="q" label="Needs work" value="n" />);
    await userEvent.setup().click(screen.getByText("Needs work"));
    expect(screen.getByRole("radio", { name: "Needs work" })).toBeChecked();
  });
});
