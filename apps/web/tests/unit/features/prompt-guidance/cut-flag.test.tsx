import { render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildNav } from "@/features/frame/nav";
import { PromptGuidanceGate } from "@/features/prompt-guidance/prompt-guidance-gate";

afterEach(cleanup);

describe("cut-flag", () => {
  it("fired cut 7 shows not-found and not the page", () => {
    render(
      <PromptGuidanceGate fired={[7]}>
        <p>the page</p>
      </PromptGuidanceGate>,
    );
    expect(screen.getByText(/There is no page in/)).toBeTruthy();
    expect(screen.queryByText("the page")).toBeNull();
  });
  it("no fired cut shows the page", () => {
    render(
      <PromptGuidanceGate fired={[]}>
        <p>the page</p>
      </PromptGuidanceGate>,
    );
    expect(screen.getByText("the page")).toBeTruthy();
  });
  it("nav entry follows the flag", () => {
    const has = (fired: number[]) =>
      JSON.stringify(buildNav("author", "/units", fired)).includes(
        "prompt-guidance",
      );
    expect(has([7])).toBe(false);
    expect(has([])).toBe(true);
  });
});
