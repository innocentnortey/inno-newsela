// NL-115 AC-16: SCR-14 wires SCR-15's onStale / onDone. A stale pin shows the SCR-14 banner (not the form's toast) and keeps
// the old snapshot on screen until Reload; a sent-back or reopened lesson is re-read.
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApprovalScreen } from "@/features/approval/approval-screen";
import { createApiClient } from "@/lib/api-client";
import { renderWithSession } from "@/test-utils/render-with-session";
import { issuesNone, lesson5Submitted } from "../../../../e2e/approval/fixtures";

const heartbeat = vi.hoisted(() => vi.fn());
vi.mock("@/features/workspace/actions/use-review-heartbeat", () => ({ useReviewHeartbeat: heartbeat }));
vi.mock("@/features/send-back/send-back-dialog", () => ({
  SendBackDialog: (p: { open: boolean; onClose: () => void; onDone?: (r: { kind: "sent_back"; versionNumber: number }) => void; onStale?: () => void }) =>
    p.open ? (
      <div>
        <button onClick={() => { p.onStale?.(); p.onClose(); }}>fake stale</button>
        <button onClick={() => { p.onDone?.({ kind: "sent_back", versionNumber: 3 }); p.onClose(); }}>fake done</button>
        <button onClick={() => p.onClose()}>fake cancel</button>
      </div>
    ) : null,
}));

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", "x-request-id": "r" } });
afterEach(cleanup);

function mount() {
  const lesson = lesson5Submitted();
  const lessonReads = vi.fn();
  const fetch = vi.fn(async (input: Request | string | URL) => {
    const path = new URL((input as Request).url).pathname;
    if (path.endsWith("/issues")) return json(issuesNone(lesson.lesson_id));
    lessonReads();
    return json(lesson);
  });
  const client = createApiClient({ baseUrl: "http://test.local", fetch: fetch as unknown as typeof globalThis.fetch });
  renderWithSession(<ApprovalScreen unitKey="g6-u4" lessonKey={lesson.lesson_key} lessonId={lesson.lesson_id} client={client} />, "approver");
  return lessonReads;
}
const ready = () => screen.findByRole("heading", { name: "Checklist" });

describe("ApprovalScreen send-back wiring", () => {
  it("onStale shows the stale banner and does not re-read until Reload", async () => {
    const reads = mount();
    await ready();
    const before = reads.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Request changes" }));
    await userEvent.click(screen.getByRole("button", { name: "fake stale" }));
    expect(await screen.findByText(/This lesson changed since you opened it/)).toBeInTheDocument();
    expect(reads.mock.calls.length).toBe(before);
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(reads.mock.calls.length).toBeGreaterThan(before));
  });

  it("onDone re-reads the lesson and cancel also re-reads", async () => {
    const reads = mount();
    await ready();
    let n = reads.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Request changes" }));
    await userEvent.click(screen.getByRole("button", { name: "fake done" }));
    await waitFor(() => expect(reads.mock.calls.length).toBeGreaterThan(n));
    expect(screen.queryByText(/This lesson changed since you opened it/)).toBeNull();
    n = reads.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Request changes" }));
    await userEvent.click(screen.getByRole("button", { name: "fake cancel" }));
    await waitFor(() => expect(reads.mock.calls.length).toBeGreaterThan(n));
  });
});
