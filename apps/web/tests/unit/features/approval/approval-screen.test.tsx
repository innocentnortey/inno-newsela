import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalScreen } from "@/features/approval/approval-screen";
import { createApiClient } from "@/lib/api-client";
import { renderWithSession } from "@/test-utils/render-with-session";
import type { Role } from "@/lib/roles";
import { errorStatus } from "@/test-utils/operations";
import { HASH_A, HASH_B, SV_A, issuesNone, lesson4InReview, lesson5Approved, lesson5Submitted } from "../../../../e2e/approval/fixtures";

const heartbeat = vi.hoisted(() => vi.fn());
vi.mock("@/features/workspace/actions/use-review-heartbeat", () => ({ useReviewHeartbeat: heartbeat }));
vi.mock("@/features/send-back/send-back-dialog", () => ({ SendBackDialog: () => null }));

type Lesson = ReturnType<typeof lesson5Submitted>;
interface Ctl { lesson: Lesson; issuesDelay: Promise<void> | null; post: (b: unknown) => Response | Promise<Response>; posts: unknown[]; history: unknown }

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-request-id": "r" } });
const errRes = (code: Parameters<typeof errorStatus>[0], details = {}) => json(errorStatus(code), { error: { code, message: "m", details } });
const ok = () => json(200, { lesson_id: "G6.U4.L5", from_state: "submitted", to_state: "approved", version: { version_id: "v", version_number: 2, content_hash: HASH_A, state_vector: SV_A }, audit_id: "a" });

let ctl: Ctl;
beforeEach(() => {
  heartbeat.mockClear();
  ctl = { lesson: lesson5Submitted(), issuesDelay: null, post: ok, posts: [], history: { versions: [], ai_spans: [], audit: [] } };
});
afterEach(cleanup);

function mount(role: Role = "approver", lesson?: Lesson) {
  if (lesson) ctl.lesson = lesson;
  const fetch = vi.fn(async (input: Request | string | URL) => {
    const req = input as Request;
    const path = new URL(req.url).pathname;
    if (path.endsWith("/transitions")) {
      ctl.posts.push(await req.clone().json());
      return ctl.post(ctl.posts.at(-1));
    }
    if (path.endsWith("/issues")) {
      await ctl.issuesDelay;
      return json(200, issuesNone(ctl.lesson.lesson_id));
    }
    if (path.endsWith("/history")) return json(200, ctl.history);
    return json(200, ctl.lesson);
  });
  const client = createApiClient({ baseUrl: "http://test.local", fetch: fetch as unknown as typeof globalThis.fetch });
  const l = ctl.lesson;
  renderWithSession(<ApprovalScreen unitKey="g6-u4" lessonKey={l.lesson_key} lessonId={l.lesson_id} client={client} />, role);
  return fetch;
}
const approve = () => screen.getByRole("button", { name: "Approve this version" });
const ready = () => screen.findByRole("heading", { name: "Checklist" });

describe("ApprovalScreen", () => {
  it("checklist glyph title evidence and jump link", async () => {
    mount();
    await ready();
    const row = screen.getByText("Standards taught and checked").closest("li")!;
    expect(row.querySelector("[data-glyph='circle-check']")).not.toBeNull();
    expect(row).toHaveTextContent("Done");
    expect(row).toHaveTextContent("W.6.2.a, W.6.2.b, W.6.2.f confirmed");
    expect(screen.getByRole("link", { name: "Jump to Learning in Action Part A" })).toHaveAttribute("href", "#sec-G6.U4.L5.LearningInAction.PartA");
    expect(screen.getByRole("heading", { name: "Lesson text (frozen at 9f3c…a21e)" })).toBeInTheDocument();
  });

  it("approve sends pin and rating once", async () => {
    mount();
    await ready();
    await userEvent.click(screen.getByLabelText("Usable with edits"));
    await userEvent.dblClick(approve());
    expect(await screen.findByText(/Approved by Approver \(demo\) · pinned 9f3c…a21e · Usable with edits/)).toBeInTheDocument();
    expect(ctl.posts).toEqual([{ action: "approve", snapshot_hash: HASH_A, snapshot_state_vector: SV_A, rating: "usable_with_edits" }]);
    expect(screen.getByText("Lesson 4 can now be approved.")).toBeInTheDocument();
  });

  it("no rating sends nothing and focuses the first radio", async () => {
    mount();
    await ready();
    await userEvent.click(approve());
    expect(screen.getByText("Choose a rating to approve.")).toBeInTheDocument();
    expect(screen.getByLabelText("Usable as drafted")).toHaveFocus();
    expect(ctl.posts).toHaveLength(0);
  });

  it("stale pin banner focuses Reload and turns the card off", async () => {
    ctl.post = () => errRes("STALE_PIN");
    mount();
    await ready();
    await userEvent.click(screen.getByLabelText("Rewritten"));
    await userEvent.click(approve());
    expect(await screen.findByText(/This lesson changed since you opened it/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toHaveFocus();
    expect(approve()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Rewritten")).toBeDisabled();
  });

  it("refusals keep Request changes", async () => {
    ctl.post = () => errRes("FOUR_EYES", { user_id: "u" });
    mount();
    await ready();
    await userEvent.click(screen.getByLabelText("Rewritten"));
    await userEvent.click(approve());
    expect(await screen.findByText(/Someone else must approve: you were the last editor/)).toBeInTheDocument();
    expect(approve()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Request changes" })).not.toHaveAttribute("aria-disabled");
  });

  it("network failure keeps the rating", async () => {
    ctl.post = () => { throw new TypeError("offline"); };
    mount();
    await ready();
    await userEvent.click(screen.getByLabelText("Usable as drafted"));
    await userEvent.click(approve());
    expect(await screen.findByText("Couldn't reach the server. Your rating is kept. Try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Usable as drafted")).toBeChecked();
  });

  it("roles hide the decision controls", async () => {
    for (const role of ["author", "reviewer"] as const) {
      mount(role);
      await ready();
      expect(screen.getByText("Only approvers can approve")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Approve this version|Request changes|Reopen/ })).toBeNull();
      expect(screen.queryByRole("radio")).toBeNull();
      cleanup();
    }
  });

  it("other states", async () => {
    mount("approver", lesson4InReview());
    expect(await screen.findByText("Lesson 4 isn't submitted yet. It's in review with M. Okafor.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your decision" })).toBeNull();
    cleanup();
    ctl.history = { versions: [], ai_spans: [], audit: [{ at: "2026-10-25T10:00:00Z", user: "D. Park", action: "approve", from_state: "submitted", to_state: "approved", version_hash: HASH_B, reason: null }] };
    mount("approver", lesson5Approved());
    expect(await screen.findByText("Approved by D. Park on 2026-10-25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen…" })).toBeInTheDocument();
    cleanup();
    mount("reviewer", lesson5Approved());
    await screen.findByText(/Approved by/);
    expect(screen.queryByRole("button", { name: "Reopen…" })).toBeNull();
  });

  it("loading and partial", async () => {
    let release: () => void = () => {};
    ctl.issuesDelay = new Promise((r) => { release = r; });
    mount();
    expect(screen.getByRole("status", { name: "Loading the approval review" })).toBeInTheDocument();
    await ready();
    expect(screen.getByRole("status", { name: "Loading the lesson text" })).toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.queryByRole("status", { name: "Loading the lesson text" })).toBeNull());
    expect(screen.getByText("Synthetic Launch text for the approval review.")).toBeInTheDocument();
  });

  it("heartbeat hook is called with the snapshot version", async () => {
    mount("reviewer");
    await ready();
    expect(heartbeat).toHaveBeenCalledWith({ lessonId: "G6.U4.L5", versionId: "lv-5-2" });
    heartbeat.mockClear();
    cleanup();
    mount("author");
    await ready();
    expect(heartbeat).not.toHaveBeenCalled();
  });
});
