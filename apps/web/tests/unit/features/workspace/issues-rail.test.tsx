import { render, waitFor, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);
import { AnnounceProvider } from "@/lib/announce";
import { IssuesTab } from "@/features/workspace/rail/issues-tab";
import { renderWithSession } from "@/test-utils/render-with-session";
import { ISSUES4, LESSON4 } from "../../../../e2e/workspace-read/fixtures";

const noop = () => {};
const el = (issues: typeof ISSUES4) => <IssuesTab issues={issues} sections={LESSON4.sections} selectedId={null} onGo={noop} />;

describe("issues rail", () => {
  it("dims_and_announces_once", async () => {
    const pending = { ...ISSUES4, pending: true };
    const { rerender } = renderWithSession(el(pending), "reviewer");
    expect(screen.getByTestId("checking").textContent).toBe("Checking…");
    for (const b of screen.getAllByRole("button")) expect(b.getAttribute("data-stale")).toBe("true");
    const before = document.activeElement;
    const user = (await import("@/test-utils/fixtures")).SESSIONS.reviewer.user;
    const { SessionProvider } = await import("@/features/frame/session-context");
    const next = { ...ISSUES4, checked_hash: "a".repeat(64) };
    rerender(
      <AnnounceProvider>
        <SessionProvider value={{ user, role: "reviewer" }}>{el(next)}</SessionProvider>
      </AnnounceProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("announcer").textContent).toBe("Blocking issues: 2"));
    expect(document.activeElement).toBe(before);
  });

  it("card_name_and_order", () => {
    renderWithSession(el(ISSUES4), "reviewer");
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names[0]).toBe("Go to issue 1: quote placeholder open in Learning in Action Part A");
    expect(names[1]).toBe("Go to issue 2: cross lesson link in Homework");
    expect(names[2]).toBe("Go to issue 3: standard confirmation");
  });

  it("resolved_group", () => {
    const resolved = { ...ISSUES4, issues: ISSUES4.issues.map((i, n) => (n === 3 ? { ...i, resolution: { by: "Reviewer A (demo)", reason: "Checked", at: "2026-10-25T16:00:00Z" } } : i)) };
    const { container } = render(
      <AnnounceProvider>{el(resolved)}</AnnounceProvider>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(3);
    const details = container.querySelector("details");
    expect(details?.textContent).toContain("Resolved (1)");
    expect(details?.textContent).toContain("Checked");
  });
});
