import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAllDrafts, clearDraft, draftKey, loadDraft, saveDraft, useDraft } from "@/lib/draft-memory";

vi.mock("next/navigation", () => ({ usePathname: () => "/units/g6-u4/board" }));

function Note() {
  const [v, set] = useDraft("note");
  return <textarea aria-label="note" value={v} onChange={(e) => set(e.target.value)} />;
}

afterEach(() => {
  cleanup();
  clearAllDrafts();
});

describe("draft memory", () => {
  it("saves, loads and clears by key", () => {
    const k = draftKey("/p", "f");
    saveDraft(k, "x");
    expect(loadDraft(k)).toBe("x");
    clearDraft(k);
    expect(loadDraft(k)).toBeUndefined();
  });
  it("keeps typed text across an unmount and remount at the same path", async () => {
    const { unmount } = render(<Note />);
    await userEvent.type(screen.getByLabelText("note"), "half-written");
    unmount();
    render(<Note />);
    expect(screen.getByLabelText("note")).toHaveValue("half-written");
  });
  it("never touches web storage", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    render(<Note />);
    await userEvent.type(screen.getByLabelText("note"), "a");
    expect(spy).not.toHaveBeenCalled();
  });
});
