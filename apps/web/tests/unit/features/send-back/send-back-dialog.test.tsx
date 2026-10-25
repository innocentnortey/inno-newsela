import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SendBackDialog } from "@/features/send-back/send-back-dialog";
import { ApiError } from "@/lib/api-client";
import { clearAllDrafts } from "@/lib/draft-memory";
import { HASH_A, SV_A, lesson5Approved, lesson5Changed, lesson5Submitted } from "../../../../e2e/approval/fixtures";

const GET = vi.fn();
const POST = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: (...a: unknown[]) => GET(...a), POST: (...a: unknown[]) => POST(...a) },
}));
const showToast = vi.fn();
vi.mock("@/features/send-back/toast-host", () => ({ showToast: (...a: unknown[]) => showToast(...a) }));

const pin = { snapshotHash: HASH_A, snapshotStateVector: SV_A };
const ID = "G6.U4.L5";
const err = (code: ApiError["code"], status = 422, message = "msg") => new ApiError({ status, code, message });
const noDeps = () => ({ ...lesson5Approved(), dependencies: [] });
const OK = { data: { version: { version_number: 3 } } };

beforeEach(() => {
  clearAllDrafts();
  GET.mockReset();
  POST.mockReset();
  showToast.mockReset();
  GET.mockResolvedValue({ data: lesson5Submitted() });
});
afterEach(cleanup);

function setup(mode: "request_changes" | "reopen", extra: { onStale?: () => void } = {}) {
  const onClose = vi.fn();
  const onDone = vi.fn();
  const ui = (
    <SendBackDialog lessonId={ID} mode={mode} pin={pin} open onClose={onClose} onDone={onDone} {...extra} />
  );
  const r = render(ui);
  return { onClose, onDone, ui, ...r };
}
const sendBtn = () => screen.getByRole("button", { name: "Send back" });
const reopenBtn = () => screen.getByRole("button", { name: "Reopen" });

describe("SendBackDialog request changes", () => {
  it("request changes shows seven unchecked tags, a note and the J. Rivera line", async () => {
    setup("request_changes");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(7);
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole("group", { name: /Reason/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toBeInTheDocument();
    expect(await screen.findByText("J. Rivera will see your tag and note on the board and in the lesson.")).toBeInTheDocument();
  });
  it("focus lands on the first tag radio", async () => {
    setup("request_changes");
    await waitFor(() => expect(screen.getAllByRole("radio")[0]).toHaveFocus());
  });
  it("no tag blocks the call", async () => {
    setup("request_changes");
    await userEvent.type(screen.getByLabelText("Note"), "x");
    await userEvent.click(sendBtn());
    expect(await screen.findByText("Choose a reason.")).toBeInTheDocument();
    expect(POST).not.toHaveBeenCalled();
  });
  it("empty note blocks the call with the spec sentence", async () => {
    setup("request_changes");
    await userEvent.click(screen.getByLabelText("AI spans"));
    await userEvent.click(sendBtn());
    expect(await screen.findByText("Add a note: say what needs to change.")).toBeInTheDocument();
    expect(POST).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Note")).toHaveFocus();
  });
  it("send back posts the exact body once and toasts", async () => {
    POST.mockResolvedValue(OK);
    const { onClose, onDone } = setup("request_changes");
    await userEvent.click(screen.getByLabelText("AI spans"));
    await userEvent.type(screen.getByLabelText("Note"), "Fix the quote");
    await userEvent.click(sendBtn());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(POST).toHaveBeenCalledTimes(1);
    expect(POST).toHaveBeenCalledWith("/lessons/{lessonId}/transitions", {
      params: { path: { lessonId: ID } },
      body: { action: "request_changes", tag: "ai_spans", note: "Fix the quote" },
    });
    expect(showToast).toHaveBeenCalledWith("Sent back to J. Rivera.");
    expect(onDone).toHaveBeenCalledWith({ kind: "sent_back", versionNumber: 3 });
  });
  it("NOTE_REQUIRED keeps the text and shows the sentence", async () => {
    POST.mockRejectedValue(err("NOTE_REQUIRED"));
    const { onClose } = setup("request_changes");
    await userEvent.click(screen.getByLabelText("Other"));
    await userEvent.type(screen.getByLabelText("Note"), "keep me");
    await userEvent.click(sendBtn());
    expect(await screen.findByText("Add a note: say what needs to change.")).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toHaveValue("keep me");
    expect(onClose).not.toHaveBeenCalled();
  });
  it("a changed snapshot hash closes as stale and sends nothing", async () => {
    GET.mockResolvedValue({ data: lesson5Changed() });
    const onStale = vi.fn();
    const { onClose } = setup("request_changes", { onStale });
    await userEvent.click(screen.getByLabelText("Other"));
    await userEvent.type(screen.getByLabelText("Note"), "x");
    await userEvent.click(sendBtn());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(POST).not.toHaveBeenCalled();
    expect(onStale).toHaveBeenCalled();
  });
  it("STALE_PIN from the server closes via onStale", async () => {
    POST.mockRejectedValue(err("STALE_PIN", 409));
    const onStale = vi.fn();
    const { onClose } = setup("request_changes", { onStale });
    await userEvent.click(screen.getByLabelText("Other"));
    await userEvent.type(screen.getByLabelText("Note"), "x");
    await userEvent.click(sendBtn());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onStale).toHaveBeenCalled();
  });
  it("STALE_PIN without onStale shows the stale toast", async () => {
    POST.mockRejectedValue(err("STALE_PIN", 409));
    const { onClose } = setup("request_changes");
    await userEvent.click(screen.getByLabelText("Other"));
    await userEvent.type(screen.getByLabelText("Note"), "x");
    await userEvent.click(sendBtn());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledWith("This lesson changed since you opened it. Reload.");
  });
  it("INVALID_TRANSITION closes and toasts", async () => {
    POST.mockRejectedValue(err("INVALID_TRANSITION", 409));
    const { onClose } = setup("request_changes");
    await userEvent.click(screen.getByLabelText("Other"));
    await userEvent.type(screen.getByLabelText("Note"), "x");
    await userEvent.click(sendBtn());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledWith("This lesson has already moved on. Showing its current state.");
  });
  it("NETWORK keeps the text and shows Try again", async () => {
    POST.mockRejectedValue(new ApiError({ status: 0, code: "NETWORK", message: "Couldn't reach Lesson Studio. Try again." }));
    const { onClose } = setup("request_changes");
    await userEvent.click(screen.getByLabelText("Other"));
    await userEvent.type(screen.getByLabelText("Note"), "kept");
    await userEvent.click(sendBtn());
    expect(await screen.findByText("Couldn't reach Lesson Studio. Try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toHaveValue("kept");
    expect(onClose).not.toHaveBeenCalled();
  });
  it("COLLAB_UNAVAILABLE keeps the text", async () => {
    POST.mockRejectedValue(err("COLLAB_UNAVAILABLE", 503));
    setup("request_changes");
    await userEvent.click(screen.getByLabelText("Other"));
    await userEvent.type(screen.getByLabelText("Note"), "kept");
    await userEvent.click(sendBtn());
    expect(await screen.findByText("The collaboration service isn't reachable right now. Try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toHaveValue("kept");
  });
  it("ROLE_FORBIDDEN shows the server sentence in an alert", async () => {
    POST.mockRejectedValue(err("ROLE_FORBIDDEN", 403, "Only approvers can request changes."));
    setup("request_changes");
    await userEvent.click(screen.getByLabelText("Other"));
    await userEvent.type(screen.getByLabelText("Note"), "x");
    await userEvent.click(sendBtn());
    expect(await screen.findByRole("alert")).toHaveTextContent("Only approvers can request changes.");
  });
  it("a second click while sending posts once", async () => {
    let release!: (v: unknown) => void;
    POST.mockReturnValue(new Promise((r) => (release = r)));
    const { onClose } = setup("request_changes");
    await userEvent.click(screen.getByLabelText("Other"));
    await userEvent.type(screen.getByLabelText("Note"), "x");
    const b = sendBtn();
    await userEvent.dblClick(b);
    await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));
    release(OK);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(POST).toHaveBeenCalledTimes(1);
  });
  it("Cancel clears the draft and closes", async () => {
    const { onClose, rerender, ui } = setup("request_changes");
    await userEvent.type(screen.getByLabelText("Note"), "gone");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    cleanup();
    render(ui);
    expect(screen.getByLabelText("Note")).toHaveValue("");
    void rerender;
  });
  it("drafts survive a remount", async () => {
    const { unmount, ui } = setup("request_changes");
    await userEvent.click(screen.getByLabelText("Standards"));
    await userEvent.type(screen.getByLabelText("Note"), "still here");
    unmount();
    render(ui);
    expect(screen.getByLabelText("Note")).toHaveValue("still here");
    expect(screen.getByLabelText("Standards")).toBeChecked();
  });
});

describe("SendBackDialog reopen", () => {
  it("reopen shows the dependants banner for Lesson 4", async () => {
    setup("reopen");
    expect(
      await screen.findByText("Lesson 4 links to this lesson. It will be flagged and held back from export until Lesson 5 is approved again."),
    ).toBeInTheDocument();
  });
  it("reopen without dependants shows no banner", async () => {
    GET.mockResolvedValue({ data: noDeps() });
    setup("reopen");
    await waitFor(() => expect(GET).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("reopen failed read shows the unknown banner", async () => {
    GET.mockRejectedValue(err("NETWORK", 0));
    setup("reopen");
    expect(await screen.findByText("Couldn't check which lessons depend on this one. Reopening will flag them.")).toBeInTheDocument();
  });
  it("reopen posts the reason and toasts the version", async () => {
    GET.mockResolvedValue({ data: lesson5Approved() });
    POST.mockResolvedValue(OK);
    const { onClose, onDone } = setup("reopen");
    await userEvent.type(screen.getByLabelText("Reason"), "Quote needs rights check");
    await userEvent.click(reopenBtn());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(POST).toHaveBeenCalledWith("/lessons/{lessonId}/transitions", {
      params: { path: { lessonId: ID } },
      body: { action: "reopen", reason: "Quote needs rights check" },
    });
    expect(showToast).toHaveBeenCalledWith("Lesson 5 reopened as version 3.");
    expect(onDone).toHaveBeenCalledWith({ kind: "reopened", versionNumber: 3 });
  });
  it("focus lands on Reason when reopening", async () => {
    setup("reopen");
    await waitFor(() => expect(screen.getByLabelText("Reason")).toHaveFocus());
  });
  it("REASON_REQUIRED keeps the text", async () => {
    POST.mockRejectedValue(err("REASON_REQUIRED"));
    setup("reopen");
    await userEvent.type(screen.getByLabelText("Reason"), "because");
    await userEvent.click(reopenBtn());
    expect(await screen.findByText("Add a reason: say why this lesson is being reopened.")).toBeInTheDocument();
    expect(screen.getByLabelText("Reason")).toHaveValue("because");
  });
});
