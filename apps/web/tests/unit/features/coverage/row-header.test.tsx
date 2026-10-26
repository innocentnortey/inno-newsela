import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StandardRowHeader } from "@/features/coverage/row-header";

afterEach(cleanup);

const TEXT = "Cite TEXTUAL evidence; as the CDE words it (not the sheet's label).";
const inRow = (props: Parameters<typeof StandardRowHeader>[0]) =>
  render(
    <table>
      <tbody>
        <tr>
          <StandardRowHeader {...props} />
        </tr>
      </tbody>
    </table>,
  );

describe("row-header", () => {
  it("shows the code and the official text exactly as returned", () => {
    inRow({
      standard: { code: "RL.6.1", official_text: TEXT, never_assessed: false },
    });
    const th = screen.getByRole("rowheader");
    expect(th.textContent).toContain("RL.6.1");
    expect(screen.getByText(TEXT)).toBeTruthy();
    expect(th.textContent).not.toContain("Never assessed");
    expect(th.querySelector("[data-glyph]")).toBeNull();
  });
  it("flags a never-assessed standard with words and the glyph", () => {
    inRow({
      standard: { code: "SL.6.1", official_text: TEXT, never_assessed: true },
    });
    const th = screen.getByRole("rowheader");
    expect(th.textContent).toContain("Never assessed");
    expect(th.querySelector('[data-glyph="triangle-bang"]')).toBeTruthy();
  });
  it("selected sets aria-current", () => {
    inRow({
      standard: { code: "RL.6.1", official_text: TEXT, never_assessed: false },
      selected: true,
    });
    expect(screen.getByRole("rowheader").getAttribute("aria-current")).toBe(
      "true",
    );
  });
});
