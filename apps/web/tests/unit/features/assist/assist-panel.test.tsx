import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistPanel } from "@/features/assist/assist-panel";
import { ApiError } from "@/lib/api-client";
import { AnnounceProvider } from "@/lib/announce";

const GET = vi.fn();
const POST = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
}));

const ANCHOR = { start: "AQSH6qQEAgA=", end: "AQSH6qQEBgA=" };
const SEL = { text: "Connection to Today's Learning", anchor: ANCHOR };
const SUG = {
  suggestion_id: "sug-4-1", status: "pending", anchor: ANCHOR, selected_text: SEL.text,
  suggested_text: "How might a storyteller's voice change a story?", requested_by: "Reviewer A (demo)",
  expires_at: "2026-10-25T16:20:00Z", decided_by: null, content_hash: null,
};
const err = (code: ApiError["code"], status = 409) => new ApiError({ status, code, message: "msg " + code });
let list: unknown[] = [];
let lessonState = "in_review";

beforeEach(() => {
  list = [];
  lessonState = "in_review";
  GET.mockReset();
  POST.mockReset();
  GET.mockImplementation(async (p: string) =>
    p === "/lessons/{lessonId}" ? { data: { state: lessonState } } : { data: { suggestions: list } },
  );
});
afterEach(cleanup);

function setup(props: Partial<React.ComponentProps<typeof AssistPanel>> = {}) {
  const onClose = vi.fn();
  render(
    <AnnounceProvider>
      <AssistPanel lessonId="G6.U4.L4" selection={SEL} onClose={onClose} {...props} />
    </AnnounceProvider>,
  );
  return { onClose };
}
const ask = () => screen.getByRole("button", { name: "Ask for a suggestion" });
const readyAsk = async () => {
  await waitFor(() => expect(ask()).not.toHaveAttribute("aria-disabled", "true"));
  return ask();
};
const postedPaths = () => POST.mock.calls.map((c) => c[0] as string);

async function askAndGetCard() {
  POST.mockResolvedValueOnce({ data: SUG });
  await userEvent.click(await readyAsk());
  return screen.findByRole("button", { name: "Accept" });
}

describe("AssistPanel", () => {
  it("shows the quote, My note, the warn line and Ask", async () => {
    setup();
    expect(screen.getByText(SEL.text)).toBeInTheDocument();
    expect(screen.getByLabelText("My note")).toBeInTheDocument();
    expect(screen.getByText("Don't paste student work.")).toBeInTheDocument();
    await readyAsk();
  });
  it("ask posts exactly anchor selected_text and note", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("My note"), "Make it a question.");
    await askAndGetCard();
    expect(POST).toHaveBeenCalledTimes(1);
    const [path, init] = POST.mock.calls[0]!;
    expect(path).toBe("/lessons/{lessonId}/suggestions");
    expect(init.body).toEqual({ anchor: ANCHOR, selected_text: SEL.text, note: "Make it a question." });
    expect(Object.keys(init.body).sort()).toEqual(["anchor", "note", "selected_text"]);
  });
  it("a returned suggestion shows Accept and Reject", async () => {
    setup();
    await askAndGetCard();
    expect(screen.getByRole("button", { name: "Reject" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(SUG.suggested_text)).toBeInTheDocument();
  });
  it("pending suggestion restored from the list", async () => {
    list = [SUG];
    setup();
    expect(await screen.findByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(POST).not.toHaveBeenCalled();
  });
  it("accept sends only decideSuggestion accept and toasts", async () => {
    const onLessonChanged = vi.fn();
    setup({ onLessonChanged });
    await askAndGetCard();
    POST.mockResolvedValueOnce({ data: { ...SUG, status: "accepted" } });
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText("Applied as your edit (AI-assisted).")).toBeInTheDocument();
    expect(postedPaths()).toEqual(["/lessons/{lessonId}/suggestions", "/lessons/{lessonId}/suggestions/{suggestionId}/decision"]);
    expect(POST.mock.calls[1]![1].body).toEqual({ decision: "accept", anchored_text_now: SEL.text });
    expect(onLessonChanged).toHaveBeenCalledTimes(1);
  });
  it("reject sends decideSuggestion reject and toasts", async () => {
    const onLessonChanged = vi.fn();
    setup({ onLessonChanged });
    await askAndGetCard();
    POST.mockResolvedValueOnce({ data: { ...SUG, status: "rejected" } });
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Discarded.")).toBeInTheDocument();
    expect(POST.mock.calls[1]![1].body).toEqual({ decision: "reject" });
    expect(onLessonChanged).not.toHaveBeenCalled();
  });
  it("ANCHOR_CHANGED shows the sentence and applies nothing", async () => {
    setup();
    await askAndGetCard();
    POST.mockRejectedValueOnce(err("ANCHOR_CHANGED"));
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText(/Text changed, ask again\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByText("Applied as your edit (AI-assisted).")).toBeNull();
    expect(POST).toHaveBeenCalledTimes(2);
  });
  it("MODEL_UNAVAILABLE keeps the note", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("My note"), "Shorter please");
    POST.mockRejectedValueOnce(err("MODEL_UNAVAILABLE", 503));
    await userEvent.click(await readyAsk());
    expect(await screen.findByText(/Couldn't get a suggestion\. Nothing changed\./)).toBeInTheDocument();
    expect(screen.getByLabelText("My note")).toHaveValue("Shorter please");
  });
  it("LESSON_LOCKED removes the form", async () => {
    setup();
    POST.mockRejectedValueOnce(err("LESSON_LOCKED"));
    await userEvent.click(await readyAsk());
    expect(await screen.findByText(/AI help isn't available/)).toBeInTheDocument();
    expect(screen.queryByLabelText("My note")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ask for a suggestion" })).toBeNull();
  });
  it("COLLAB_UNAVAILABLE keeps the suggestion pending", async () => {
    setup();
    await askAndGetCard();
    POST.mockRejectedValueOnce(err("COLLAB_UNAVAILABLE", 503));
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText(/collaboration service isn't reachable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Reject" })).not.toHaveAttribute("aria-disabled", "true");
  });
  it("INVALID_TRANSITION re-reads the list", async () => {
    list = [SUG];
    setup();
    await screen.findByRole("button", { name: "Accept" });
    const reads = () => GET.mock.calls.filter((c) => c[0] === "/lessons/{lessonId}/suggestions").length;
    const before = reads();
    list = [];
    POST.mockRejectedValueOnce(err("INVALID_TRANSITION"));
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText(/already decided/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Accept" })).toBeNull());
    expect(reads()).toBe(before + 1);
  });
  it("no selection disables Ask", async () => {
    setup({ selection: null });
    expect(screen.getByText("Select some text in the lesson first.")).toBeInTheDocument();
    await waitFor(() => expect(GET).toHaveBeenCalled());
    expect(ask()).toHaveAttribute("aria-disabled", "true");
  });
  it("a locked lesson state is not offered", async () => {
    lessonState = "submitted";
    setup();
    expect(await screen.findByText(/AI help isn't available/)).toBeInTheDocument();
    expect(screen.queryByLabelText("My note")).toBeNull();
    expect(GET.mock.calls.some((c) => c[0] === "/lessons/{lessonId}/suggestions")).toBe(false);
  });
  it("onPendingChange tracks pending", async () => {
    const onPendingChange = vi.fn();
    setup({ onPendingChange });
    await askAndGetCard();
    await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(true));
    POST.mockResolvedValueOnce({ data: SUG });
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(false));
  });
  it("a second click while asking posts once", async () => {
    setup();
    let release: (v: unknown) => void = () => {};
    POST.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const btn = await readyAsk();
    await userEvent.dblClick(btn);
    expect(POST).toHaveBeenCalledTimes(1);
    await act(async () => release({ data: SUG }));
    expect(await screen.findByRole("button", { name: "Accept" })).toBeInTheDocument();
  });
  it("the back button calls onClose", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Back to the rail" }));
    expect(onClose).toHaveBeenCalled();
  });
});
