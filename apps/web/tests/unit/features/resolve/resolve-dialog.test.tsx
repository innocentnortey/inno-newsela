import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResolveDialog } from "@/features/resolve/resolve-dialog";
import { ApiError } from "@/lib/api-client";
import { clearAllDrafts } from "@/lib/draft-memory";
import { renderWithSession } from "@/test-utils/render-with-session";

const mocks = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({ ...(await orig<typeof import("@/lib/api-client")>()), api: mocks }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const RESULT = { data: { item_id: "x", status: "resolved", by: "J. Rivera", at: "t", audit_id: "a", counts: {} } };
const err = (code: string, details = {}) => new ApiError({ status: 422, code: code as never, message: "x", details });

beforeEach(() => {
  clearAllDrafts();
  mocks.GET.mockImplementation(async (url: string) =>
    url.endsWith("/issues")
      ? { data: { issues: [{ issue_id: "i1", message: "Quote placeholder open" }, { issue_id: "f1", message: "Safety flag open" }] } }
      : { data: { outline_row: { segments: [{ kind: "safety_note", text: "Warn students" }] } } },
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const props = { lessonId: "L", open: true, onClose: vi.fn(), onResolved: vi.fn() };

describe("ResolveDialog", () => {
  it("resolve mode renders", async () => {
    renderWithSession(<ResolveDialog {...props} mode="resolve" issueId="i1" />, "reviewer");
    expect(screen.getByLabelText("Reason (required)")).toBeTruthy();
    expect(screen.getByText("Counted as a resolution, not a fix.")).toBeTruthy();
    expect(await screen.findByText("Quote placeholder open")).toBeTruthy();
  });

  it("clear mode renders flag, tip and logging line", async () => {
    renderWithSession(<ResolveDialog {...props} mode="clear_flag" flagId="f1" />, "approver");
    expect(await screen.findByText("Warn students")).toBeTruthy();
    expect(screen.getByLabelText("Note (required)")).toBeTruthy();
    expect(screen.getByText(/logged and shown on the approver/)).toBeTruthy();
  });

  it("sends the raw value once and shows REASON_REQUIRED, keeping text", async () => {
    mocks.POST.mockRejectedValue(err("REASON_REQUIRED"));
    renderWithSession(<ResolveDialog {...props} mode="resolve" issueId="i1" />, "reviewer");
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "   " } });
    await userEvent.click(screen.getByRole("button", { name: "Record resolution" }));
    expect(await screen.findByText("A resolution needs a reason. Say what was done and where.")).toBeTruthy();
    expect(mocks.POST).toHaveBeenCalledTimes(1);
    expect(mocks.POST.mock.calls[0]![1].body).toEqual({ reason: "   " });
    const box = screen.getByLabelText("Reason (required)") as HTMLTextAreaElement;
    expect(box.value).toBe("   ");
    await waitFor(() => expect(document.activeElement).toBe(box));
  });

  it("NOT_RESOLVABLE names details.use", async () => {
    mocks.POST.mockRejectedValue(err("NOT_RESOLVABLE", { use: "Clear flag" }));
    renderWithSession(<ResolveDialog {...props} mode="resolve" issueId="i1" />, "reviewer");
    await userEvent.click(screen.getByRole("button", { name: "Record resolution" }));
    expect((await screen.findByRole("alert")).textContent).toContain('Use "Clear flag" instead.');
  });

  it("author in clear mode has no Clear flag button", () => {
    renderWithSession(<ResolveDialog {...props} mode="clear_flag" flagId="f1" />, "author");
    expect(screen.getByText("Only reviewers and approvers can clear a flag.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear flag" })).toBeNull();
  });

  it("success closes, calls onResolved and shows the toast; storage untouched", async () => {
    const ls = vi.spyOn(Storage.prototype, "setItem");
    mocks.POST.mockResolvedValue(RESULT);
    const onClose = vi.fn();
    const onResolved = vi.fn();
    renderWithSession(<ResolveDialog {...props} onClose={onClose} onResolved={onResolved} mode="resolve" issueId="i1" />, "reviewer");
    fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "done" } });
    await userEvent.click(screen.getByRole("button", { name: "Record resolution" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onResolved).toHaveBeenCalled();
    expect(await screen.findByText("Issue resolved by J. Rivera.")).toBeTruthy();
    expect(ls).not.toHaveBeenCalled();
  });
});
