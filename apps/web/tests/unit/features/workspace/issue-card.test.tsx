import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IssueCard } from "@/features/workspace/rail/issue-card";
import type { components } from "@/lib/api-types";

afterEach(cleanup);
type Issue = components["schemas"]["Issue"];

const base: Issue = {
  issue_id: "iss-1",
  level: "blocking",
  blocks: ["submit", "approve"],
  resolvable: true,
  kind: "cross_lesson_link",
  message: "Homework text not chosen",
  address: "G6.U4.L4.Homework",
  span_anchor: null,
  related_lesson_id: "G6.U4.L5",
  resolution: null,
};
const norm = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
const noop = () => {};

describe("IssueCard", () => {
  it("accessible name contains the visible text", () => {
    const cases: [Issue, boolean][] = [
      [base, false],
      [{ ...base, level: "advisory", address: null, kind: "eld_label_mismatch" }, false],
      [base, true],
    ];
    cases.forEach(([issue, selected], i) => {
      const { unmount } = render(
        <ul>
          <IssueCard issue={issue} number={i + 1} sectionLabel="Homework" selected={selected} stale={i === 1} onGo={noop} />
        </ul>,
      );
      const btn = screen.getByRole("button");
      const name = norm(btn.getAttribute("aria-label"));
      expect(name.startsWith(`Go to issue ${i + 1}: `)).toBe(true);
      // The visible words, with a space between each visual chunk (as accessible-name computation does).
      const visible = [...btn.querySelectorAll("span")]
        .filter((s) => s.children.length === 0 && s.textContent)
        .map((s) => norm(s.textContent))
        .join(" ");
      expect(name).toContain(visible);
      unmount();
    });
  });

  it("resolved card keeps no button", () => {
    render(
      <ul>
        <IssueCard
          issue={{ ...base, resolution: { by: "Sam", reason: "Chosen", at: "2026-10-25T10:00:00Z" } as Issue["resolution"] }}
          number={1}
          sectionLabel={null}
          selected={false}
          stale={false}
          onGo={noop}
        />
      </ul>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
