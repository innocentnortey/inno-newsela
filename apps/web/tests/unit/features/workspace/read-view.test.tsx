import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);
import { LessonText } from "@/features/workspace/read-view/lesson-text";
import { TextCardView } from "@/features/workspace/read-view/text-card";
import { LESSON4, lessonWith } from "../../../../e2e/workspace-read/fixtures";

const withDoc = (content: object[]) =>
  lessonWith("in_review", {
    sections: [{ address: "G6.U4.L4.Launch", name: "Launch", minutes: 5, content: { type: "doc", content } as never }],
    text_cards: [],
  });
const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

describe("read view", () => {
  it("renders_text_not_html", () => {
    const { container } = render(<LessonText lesson={withDoc([para("<img src=x onerror=alert(1)>"), para("<script>alert(1)</script>")])} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(screen.getByText("<script>alert(1)</script>")).toBeTruthy();
  });

  it("headings_stay_in_order", () => {
    const h = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
    const { container } = render(<LessonText lesson={withDoc([h(3, "A"), h(1, "B"), h(5, "C")])} />);
    const tags = [...container.querySelectorAll("h2,h3,h4,h5,h6")].map((e) => Number(e.tagName[1]));
    expect(tags[0]).toBe(2);
    expect(tags[1]).toBe(3);
    for (let i = 1; i < tags.length; i++) expect(tags[i]! - tags[i - 1]!).toBeLessThanOrEqual(1);
  });

  it("quote_slot_shows_rights", () => {
    const { container } = render(<LessonText lesson={LESSON4} />);
    expect(screen.getByText(/Reviewer to insert/)).toBeTruthy();
    expect(screen.getByText("Rights: short-quote-commentary")).toBeTruthy();
    expect(container.querySelector('[data-node="quote_placeholder"]')?.textContent).toContain("1");
  });

  it("unknown_node_is_visible_not_dropped", () => {
    render(<LessonText lesson={withDoc([{ type: "mystery_block" }])} />);
    expect(screen.getByText("Unsupported content: mystery_block is not shown.")).toBeTruthy();
  });

  it("text_card_isbn", () => {
    render(<TextCardView card={LESSON4.text_cards[0]!} />);
    expect(screen.getByTestId("text-card").textContent).toContain("ISBN 9780786838653");
    expect(screen.getByText("off-platform-text")).toBeTruthy();
  });

  it("no_innerhtml_in_source", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    const files = walk(path.resolve(import.meta.dirname, "../../../../src/features/workspace")).filter((f) => /\.(ts|tsx)$/.test(f));
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toContain("innerHTML");
  });
});
