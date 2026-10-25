import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, afterEach } from "vitest";
import { AssistPanel } from "@/features/assist/assist-panel";
import { InsertQuoteDialog } from "@/features/insert-quote/insert-quote-dialog";
import { renderWithSession } from "@/test-utils/render-with-session";
import { ResolveDialog } from "@/features/resolve/resolve-dialog";
import { SendBackDialog } from "@/features/send-back/send-back-dialog";
import { StartRunDialog } from "@/features/start-run/start-run-dialog";

const pin = { snapshotHash: "h", snapshotStateVector: "v" };
const dialogs: Array<[string, (open: boolean, onClose: () => void) => React.ReactElement, string]> = [
  ["StartRunDialog", (open, onClose) => <StartRunDialog outlineVersionId="ov1" open={open} onClose={onClose} />, "Start a run"],
  ["InsertQuoteDialog", (open, onClose) => <InsertQuoteDialog lessonId="G6.U4.L4" slotId="s1" open={open} onClose={onClose} />, "Insert quote or excerpt"],
  ["ResolveDialog", (open, onClose) => <ResolveDialog lessonId="G6.U4.L4" mode="resolve" open={open} onClose={onClose} />, "Record a resolution"],
  ["SendBackDialog", (open, onClose) => <SendBackDialog lessonId="G6.U4.L4" mode="reopen" pin={pin} open={open} onClose={onClose} />, "Reopen Lesson 4"],
];

afterEach(cleanup);

describe("handed-over shells", () => {
  for (const [name, make, title] of dialogs) {
    it(`${name} shows its title when open and closes`, async () => {
      const onClose = vi.fn();
      const { unmount } = renderWithSession(make(true, onClose));
      expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
      await userEvent.click(screen.getAllByRole("button", { name: "Close" })[0]!);
      expect(onClose).toHaveBeenCalled();
      unmount();
      render(make(false, onClose));
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  }

  it("AssistPanel is a labelled region with a back button", async () => {
    const onClose = vi.fn();
    render(<AssistPanel lessonId="G6.U4.L4" selection={null} onClose={onClose} />);
    expect(screen.getByRole("region", { name: "AI assist" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to the rail" }));
    expect(onClose).toHaveBeenCalled();
  });
});
