import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IssueOpenerButtons, StandardDecisionButtons } from "@/features/workspace/actions/standard-decision";
import { COLLAB_DOWN, UNDO_GONE } from "@/features/workspace/actions/copy";
import { ApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";
import { renderWithSession } from "@/test-utils/render-with-session";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: vi.fn(), POST: post },
}));

const changed = vi.fn();
const show = (o: { role?: Role; origin?: "narrowed" | "outline"; confirmation?: "open" | "confirmed" } = {}) =>
  renderWithSession(
    <StandardDecisionButtons lessonId="G6.U4.L4" code="L.6.4.b" origin={o.origin ?? "narrowed"} confirmation={o.confirmation ?? "open"} onChanged={changed} />,
    o.role ?? "reviewer",
  );
const click = async (name: RegExp | string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  changed.mockReset();
  post.mockReset().mockResolvedValue({ data: { audit_id: "aud-0102", status: "confirmed" } });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("standard decision", () => {
  it("Confirm acts at once and shows Undo for 6 seconds", async () => {
    show();
    await click("Confirm L.6.4.b");
    expect(post).toHaveBeenCalledWith("/lessons/{lessonId}/standards/decision", { params: { path: { lessonId: "G6.U4.L4" } }, body: { code: "L.6.4.b", decision: "confirm" } });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Confirmed L.6.4.b.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(5_900));
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
  });

  it("Undo posts undo with undo_of the audit id", async () => {
    show();
    await click("Remove L.6.4.b");
    await click("Undo");
    expect(post).toHaveBeenLastCalledWith("/lessons/{lessonId}/standards/decision", { params: { path: { lessonId: "G6.U4.L4" } }, body: { code: "L.6.4.b", decision: "undo", undo_of: "aud-0102" } });
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("the toast disappears after 6 seconds", async () => {
    show();
    await click("Confirm L.6.4.b");
    await act(() => vi.advanceTimersByTimeAsync(6_000));
    expect(screen.queryByText("Confirmed L.6.4.b.", { selector: "p" })).toBeNull();
  });

  it("UNDO_EXPIRED closes the toast and re-reads", async () => {
    show();
    await click("Confirm L.6.4.b");
    post.mockRejectedValueOnce(new ApiError({ status: 409, code: "UNDO_EXPIRED", message: "x" }));
    await click("Undo");
    expect(screen.getByText(UNDO_GONE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("COLLAB_UNAVAILABLE says nothing changed", async () => {
    post.mockRejectedValue(new ApiError({ status: 503, code: "COLLAB_UNAVAILABLE", message: "x" }));
    show();
    await click("Confirm L.6.4.b");
    expect(screen.getByRole("alert").textContent).toBe(COLLAB_DOWN);
    expect(screen.getByRole("button", { name: "Confirm L.6.4.b" })).toBeTruthy();
    expect(changed).not.toHaveBeenCalled();
  });

  it("hidden for author, approver and non-narrowed codes", () => {
    for (const role of ["author", "approver"] as const) {
      const { container } = show({ role });
      expect(container.textContent).toBe("");
      cleanup();
    }
    expect(show({ origin: "outline" }).container.textContent).toBe("");
    cleanup();
    expect(show({ confirmation: "confirmed" }).container.textContent).toBe("");
  });

  it("IssueOpenerButtons shows Resolve and Clear flag by role", () => {
    const issue = (o: Partial<components["schemas"]["Issue"]>) => ({ resolvable: true, resolution: null, kind: "quote_placeholder_open", ...o }) as components["schemas"]["Issue"];
    const el = (i: components["schemas"]["Issue"]) => <IssueOpenerButtons issue={i} onResolve={() => {}} onClearFlag={() => {}} />;
    renderWithSession(el(issue({})), "reviewer");
    expect(screen.getByRole("button", { name: "Resolve…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear flag…" })).toBeNull();
    cleanup();
    renderWithSession(el(issue({ resolvable: false, kind: "safety_flag_open" })), "approver");
    expect(screen.queryByRole("button", { name: "Resolve…" })).toBeNull();
    expect(screen.getByRole("button", { name: "Clear flag…" })).toBeTruthy();
    cleanup();
    expect(renderWithSession(el(issue({})), "author").container.textContent).toBe("");
  });
});
