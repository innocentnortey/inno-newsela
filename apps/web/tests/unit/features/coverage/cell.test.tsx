import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CoverageCell } from "@/features/coverage/cell";
import type { Cell } from "@/features/coverage/copy";

afterEach(cleanup);

const base: Cell = {
  code: "RL.6.1",
  lesson_id: "G6.U4.L4",
  roles: ["I", "P"],
  confirmed_by: "judge_only",
  source: "approved",
};
const inRow = (cell?: Cell) =>
  render(
    <table>
      <tbody>
        <tr>
          <CoverageCell cell={cell} />
        </tr>
      </tbody>
    </table>,
  );

describe("cell", () => {
  it("judge only reads in full words", () => {
    inRow(base);
    const td = screen.getByRole("cell");
    expect(td.textContent).toContain("Introduced, Practised");
    expect(td.textContent).toContain("Judge only, not confirmed by a person");
    expect(td.textContent).toContain("From the approved version");
  });
  it("generator only and person", () => {
    inRow({ ...base, confirmed_by: "generator_only", source: "working" });
    expect(screen.getByRole("cell").textContent).toContain("Generator only");
    expect(screen.getByRole("cell").textContent).toContain("working draft");
    cleanup();
    inRow({ ...base, confirmed_by: "person" });
    expect(screen.getByRole("cell").textContent).toContain(
      "Confirmed by a person",
    );
  });
  it("no cell reads Not taught here", () => {
    inRow(undefined);
    expect(screen.getByRole("cell").textContent).toContain("Not taught here");
  });
  it("shows the roles in I, P, A order and no controls", () => {
    inRow({ ...base, roles: ["A", "I"] });
    const letters = screen
      .getByRole("cell")
      .querySelector("[aria-hidden]") as HTMLElement;
    expect(letters.textContent).toBe("I A");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
