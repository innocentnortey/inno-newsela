import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Provenance } from "@/features/history/provenance";
import { hash, version } from "./fixtures";

afterEach(cleanup);

describe("Provenance", () => {
  it("renders all seven fields when present", () => {
    render(<Provenance version={version({ version_number: 1 })} />);
    for (const l of [
      "Outline-row hash",
      "Prompt version",
      "Model",
      "Schema version",
      "Example set",
      "Run",
      "Cost",
    ]) {
      expect(screen.getByText(l)).toBeTruthy();
    }
    expect(screen.getByText(hash(900))).toBeTruthy();
    expect(screen.getByText("$0.52")).toBeTruthy();
    expect(screen.queryByText("Missing")).toBeNull();
  });

  it("renders Missing in danger when a field is absent", () => {
    const v = version({ version_number: 1 });
    delete (v.provenance as unknown as Record<string, unknown>)
      .prompt_version_id;
    (v.provenance as unknown as Record<string, unknown>).run_id = null;
    const { container } = render(<Provenance version={v} />);
    const missing = screen.getAllByText("Missing");
    expect(missing).toHaveLength(2);
    for (const m of missing) expect(m.className).toContain("text-danger");
    for (const dd of container.querySelectorAll("dd"))
      expect((dd.textContent ?? "").length).toBeGreaterThan(0);
  });

  it("shows not applicable for human-made model and example set", () => {
    const base = version({ version_number: 3 });
    const v = version({
      version_number: 3,
      kind: "submit",
      provenance: {
        ...base.provenance,
        model: null,
        example_set_id: null,
        cost_usd: 0,
      },
    });
    render(<Provenance version={v} />);
    expect(screen.queryByText("Missing")).toBeNull();
    expect(
      screen.getAllByText("Not applicable (made by a person)"),
    ).toHaveLength(2);
    expect(screen.getByText("$0.00")).toBeTruthy();
  });
});
