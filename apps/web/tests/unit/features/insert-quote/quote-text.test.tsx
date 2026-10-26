import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InsertQuoteDialog } from "@/features/insert-quote/insert-quote-dialog";
import { clearAllDrafts } from "@/lib/draft-memory";
import { renderWithSession } from "@/test-utils/render-with-session";
import { GET, POST, QUOTE, lessonWith } from "./helpers";

vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/lessons/G6.U4.L4/quote-text" }));

beforeEach(() => {
  GET.mockReset().mockResolvedValue({ data: lessonWith("in_review", QUOTE) });
  POST.mockReset().mockRejectedValue(new Error("keep the form open"));
});
afterEach(cleanup);

async function send(value: string) {
  renderWithSession(<InsertQuoteDialog lessonId="G6.U4.L4" slotId="s1" open onClose={vi.fn()} />, "reviewer");
  const box = await screen.findByLabelText("Text");
  fireEvent.change(box, { target: { value } });
  await userEvent.type(screen.getByLabelText("Book or title"), "Synthetic Reader");
  await userEvent.click(screen.getByRole("button", { name: "Insert" }));
  await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));
  return box as HTMLTextAreaElement;
}

describe("quote text is never rendered as HTML or altered", () => {
  it("sends and shows <b onmouseover=x> as plain text", async () => {
    const value = "<b onmouseover=x>";
    const box = await send(value);
    expect(POST.mock.calls[0]?.[1].body.text).toBe(value);
    expect(box.value).toBe(value);
    expect(document.querySelector("b")).toBeNull();
  });
  it("keeps leading and trailing spaces", async () => {
    await send("  spaced out  ");
    expect(POST.mock.calls[0]?.[1].body.text).toBe("  spaced out  ");
  });
});

describe("empty fields are caught before any request", () => {
  beforeEach(() => clearAllDrafts());
  async function open() {
    renderWithSession(<InsertQuoteDialog lessonId="G6.U4.L4" slotId="s1" open onClose={vi.fn()} />, "reviewer");
    await screen.findByLabelText("Text");
  }
  it("empty text shows the field message", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(await screen.findByText("Add the quote text.")).toBeTruthy();
    expect(POST).not.toHaveBeenCalled();
    expect(screen.queryByText("The request is not valid.")).toBeNull();
  });
  it("missing source shows the source sentence", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Text"), { target: { value: "Short quote." } });
    await userEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(await screen.findByText("A quote needs a source: add the book and page, or the URL.")).toBeTruthy();
    expect(POST).not.toHaveBeenCalled();
  });
});
