import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InsertQuoteDialog } from "@/features/insert-quote/insert-quote-dialog";
import { renderWithSession } from "@/test-utils/render-with-session";
import { clearAllDrafts } from "@/lib/draft-memory";
import { EXCERPT, GET, NINE, OK, POST, QUOTE, THIRTEEN, err, lessonWith } from "./helpers";

vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/lessons/G6.U4.L4" }));
const announce = vi.fn();
vi.mock("@/lib/announce", async (orig) => ({ ...(await orig<typeof import("@/lib/announce")>()), useAnnounce: () => announce }));

beforeEach(() => {
  clearAllDrafts();
  announce.mockReset();
  GET.mockReset().mockResolvedValue({ data: lessonWith("in_review", QUOTE) });
  POST.mockReset().mockResolvedValue({ data: OK });
});
afterEach(cleanup);

const setup = (onClose = vi.fn(), onFilled?: () => void) => {
  const view = renderWithSession(<InsertQuoteDialog lessonId="G6.U4.L4" slotId="s1" open onClose={onClose} onFilled={onFilled} />, "reviewer");
  return { onClose, ...view };
};
const textBox = async () => (await screen.findByLabelText("Text")) as HTMLTextAreaElement;
const type = async (v: string) => fireEvent.change(await textBox(), { target: { value: v } });
const insert = () => screen.getByRole("button", { name: "Insert" });
const typeSource = () => userEvent.type(screen.getByLabelText("Book or title"), "Synthetic Reader");

describe("InsertQuoteDialog", () => {
  it("titles by kind and shows URL only for excerpts", async () => {
    setup();
    await textBox();
    expect(screen.getByRole("dialog", { name: "Insert quote" })).toBeInTheDocument();
    expect(screen.queryByLabelText("URL")).toBeNull();
    cleanup();
    GET.mockResolvedValue({ data: lessonWith("in_review", EXCERPT) });
    setup();
    await textBox();
    expect(screen.getByRole("dialog", { name: "Fill excerpt slot" })).toBeInTheDocument();
    expect(screen.getByLabelText("URL")).toBeInTheDocument();
    await waitFor(() => expect((screen.getByLabelText("Rights status") as HTMLSelectElement).value).toBe("to-clear"));
  });

  it("focuses Text on open and shows the slot ask", async () => {
    setup();
    const box = await textBox();
    await waitFor(() => expect(box).toHaveFocus());
    expect(screen.getByText("Reviewer to insert one sentence")).toBeInTheDocument();
  });

  it("counts words only under short-quote-commentary", async () => {
    setup();
    await type(NINE);
    expect(screen.getByText("9 of 12 words")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Rights status"), "public-domain");
    expect(screen.queryByText("9 of 12 words")).toBeNull();
  });

  it("announces once on crossing 12, not on 5 to 6", async () => {
    setup();
    await type("one two three four five");
    await type("one two three four five six");
    expect(announce).not.toHaveBeenCalled();
    await type("one two three four five six seven eight nine ten eleven twelve");
    expect(announce).not.toHaveBeenCalled();
    await type(THIRTEEN);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("sends 13 words once; QUOTE_TOO_LONG lands on Text and keeps it", async () => {
    POST.mockRejectedValue(err("QUOTE_TOO_LONG", { word_count: 13 }));
    setup();
    await type(THIRTEEN);
    await typeSource();
    await userEvent.click(insert());
    const box = await textBox();
    const msg = await screen.findByText(/13 of 12 words: a short-quote-commentary quote is 12 words or fewer/);
    expect(POST).toHaveBeenCalledTimes(1);
    expect(box.getAttribute("aria-describedby")).toContain(msg.id);
    expect(box.value).toBe(THIRTEEN);
  });

  it("SOURCE_REQUIRED lands on the Source title input", async () => {
    POST.mockRejectedValue(err("SOURCE_REQUIRED"));
    setup();
    await type(NINE);
    await userEvent.click(insert());
    const msg = await screen.findByText("A quote needs a source: add the book and page, or the URL.");
    expect(screen.getByLabelText("Book or title").getAttribute("aria-describedby")).toContain(msg.id);
  });

  it.each([
    ["network", new Error("boom"), "Couldn't insert. Your text is kept. Try again."],
    ["ROLE_FORBIDDEN", err("ROLE_FORBIDDEN"), "Only reviewers insert quotes."],
    ["LESSON_LOCKED", err("LESSON_LOCKED"), "This lesson is locked. Withdraw it first to insert a quote."],
  ])("%s shows a banner and keeps the text", async (_n, e, sentence) => {
    POST.mockRejectedValue(e);
    setup();
    await type(NINE);
    await typeSource();
    await userEvent.click(insert());
    expect(await screen.findByText(sentence)).toBeInTheDocument();
    expect((await textBox()).value).toBe(NINE);
  });

  it("success closes with a toast", async () => {
    const { onClose } = setup();
    await type(NINE);
    await typeSource();
    await userEvent.click(insert());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(POST.mock.calls[0]?.[1].body).toMatchObject({ text: NINE, rights_status: "short-quote-commentary", source_ref: { title: "Synthetic Reader", chapter: null, pages: null } });
  });

  it("on_filled_called_once_after_success", async () => {
    const onFilled = vi.fn();
    const { onClose } = setup(vi.fn(), onFilled);
    await type(NINE);
    await typeSource();
    await userEvent.click(insert());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onFilled).toHaveBeenCalledTimes(1);
  });

  it("on_filled_not_called_on_refusal", async () => {
    POST.mockRejectedValue(err("SOURCE_REQUIRED"));
    const onFilled = vi.fn();
    setup(vi.fn(), onFilled);
    await type(NINE);
    await typeSource();
    await userEvent.click(insert());
    await waitFor(() => expect(POST).toHaveBeenCalled());
    expect(onFilled).not.toHaveBeenCalled();
  });

  it("to-clear success says it is still blocking", async () => {
    GET.mockResolvedValue({ data: lessonWith("in_review", EXCERPT) });
    const { onClose } = setup();
    await type(NINE);
    await typeSource();
    await userEvent.click(insert());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(POST).toHaveBeenCalledTimes(1);
  });

  it("a frozen lesson offers no Insert", async () => {
    GET.mockResolvedValue({ data: lessonWith("submitted", QUOTE) });
    setup();
    expect(await screen.findByText("This lesson is locked. Withdraw it first to insert a quote.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Insert" })).toBeNull();
  });

  it("keeps drafts across unmount and clears them on Cancel", async () => {
    const first = setup();
    await type(NINE);
    first.unmount();
    setup();
    expect((await textBox()).value).toBe(NINE);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });
    cleanup();
    setup();
    expect((await textBox()).value).toBe("");
  });
});
