import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PresenceEntry } from "@/editor/presence";
import { PresenceInitials, PresenceSentence } from "@/features/workspace/live/presence-sentence";

afterEach(cleanup);
const e = (client_id: number, address: string): PresenceEntry => ({ client_id, name: "M. Okafor", initials: "MO", slot: 2, section_address: address, section_name: "Part B" });

describe("presence components", () => {
  it("renders the sentence as text", () => {
    render(<PresenceSentence entries={[e(2, "S.B")]} />);
    expect(screen.getByTestId("presence-sentence")).toHaveTextContent("M. Okafor is editing Part B");
  });
  it("renders nothing when empty", () => {
    const { container } = render(<PresenceSentence entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("initials show only for the matching section", () => {
    const { container } = render(<PresenceInitials entries={[e(2, "S.B"), e(3, "S.A")]} address="S.B" />);
    expect(container.querySelectorAll("[data-slot=initials]")).toHaveLength(1);
    expect(screen.getByLabelText("M. Okafor is here")).toHaveTextContent("MO");
  });
});
