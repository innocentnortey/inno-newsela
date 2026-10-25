import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOT_STORED_HOLD_MS, WorkspaceActionBar } from "@/features/workspace/actions/action-bar";
import { COLLAB_DOWN, DISCLOSURE, DRAFTING, REGEN_CAP, REGEN_LOCKED, REVIEWER_NOTE } from "@/features/workspace/actions/copy";
import { ApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";
import { renderWithSession } from "@/test-utils/render-with-session";

const m = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: m.get, POST: m.post },
}));

type Lesson = components["schemas"]["Lesson"];
type Issue = components["schemas"]["Issue"];
const lesson = (o: Partial<Lesson> = {}): Lesson =>
  ({ lesson_id: "G6.U4.L4", lesson_key: "L4", number: 4, state: "in_review", state_vector: "AQ==", ...o }) as Lesson;
const issue = (o: Partial<Issue> = {}): Issue =>
  ({ issue_id: "i1", level: "blocking", blocks: ["submit"], resolvable: false, kind: "section_missing", message: "m", address: null, span_anchor: null, related_lesson_id: null, resolution: null, ...o }) as Issue;
const list = (...issues: Issue[]) => ({ lesson_id: "G6.U4.L4", issues }) as components["schemas"]["IssueList"];
const transitionBodies = () => m.post.mock.calls.filter((c) => c[0].endsWith("/transitions")).map((c) => c[1].body);

function show(opts: { role?: Role; l?: Partial<Lesson>; issues?: Issue[]; cs?: "stored" | "saving"; changed?: () => void; strict?: boolean } = {}) {
  const ui = (
    <>
      <button data-issue-card>card</button>
      <WorkspaceActionBar lesson={lesson(opts.l)} issues={list(...(opts.issues ?? []))} clientState={opts.cs ?? "stored"} onLessonChanged={opts.changed} />
    </>
  );
  return renderWithSession(opts.strict ? <StrictMode>{ui}</StrictMode> : ui, opts.role ?? "reviewer");
}
const submitBtn = () => screen.getByRole("button", { name: /Submit for approval/ });
const blocked = new ApiError({ status: 422, code: "BLOCKED", message: "x", details: { issues: [{ level: "blocking", message: "RL.6.2 has no checking item" }] } });

beforeEach(() => {
  m.post.mockReset().mockResolvedValue({ data: { lesson_id: "G6.U4.L4" } });
});
afterEach(cleanup);

describe("action bar", () => {
  it("submit reasons render one line each and Submit is aria-disabled", () => {
    show({ issues: [issue({ issue_id: "1" }), issue({ issue_id: "2" }), issue({ issue_id: "3" }), issue({ issue_id: "4", level: "confirmation", kind: "standard_confirmation" })], cs: "saving" });
    expect(submitBtn().getAttribute("aria-disabled")).toBe("true");
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["3 blocking issues", "1 standard to confirm", "Saving"]);
  });

  it("pressing a disabled Submit focuses the first issue card and posts nothing", async () => {
    show({ issues: [issue()] });
    await userEvent.click(submitBtn());
    expect(document.activeElement).toBe(screen.getByText("card"));
    expect(m.post).not.toHaveBeenCalled();
  });

  it("Submit enabled posts client_state_vector", async () => {
    const changed = vi.fn();
    show({ changed });
    expect(submitBtn().getAttribute("aria-disabled")).toBeNull();
    await userEvent.click(submitBtn());
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(transitionBodies()).toEqual([{ action: "submit", client_state_vector: "AQ==" }]);
    expect(screen.getByText("Lesson 4 submitted for approval.")).toBeTruthy();
  });

  it("refusals: BLOCKED shows the refusal sentence and nothing else changes", async () => {
    m.post.mockRejectedValue(blocked);
    const changed = vi.fn();
    show({ changed });
    await userEvent.click(submitBtn());
    expect((await screen.findByRole("alert")).textContent).toContain("Submit refused: RL.6.2 has no checking item on the stored copy.");
    expect(changed).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
    expect(submitBtn()).toBeTruthy();
  });

  it("refusals: NOT_STORED adds Saving", async () => {
    m.post.mockRejectedValue(new ApiError({ status: 409, code: "NOT_STORED", message: "x" }));
    show();
    await userEvent.click(submitBtn());
    await waitFor(() => expect(screen.getByText("Saving")).toBeTruthy());
    expect(submitBtn().getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("refusals: NOT_STORED hold ends after a short wait so Submit can be retried", async () => {
    m.post.mockRejectedValue(new ApiError({ status: 409, code: "NOT_STORED", message: "x" }));
    show();
    await userEvent.click(submitBtn());
    await waitFor(() => expect(screen.getByText("Saving")).toBeTruthy());
    await waitFor(() => expect(screen.queryByText("Saving")).toBeNull(), { timeout: NOT_STORED_HOLD_MS + 1500 });
    expect(submitBtn().getAttribute("aria-disabled")).not.toBe("true");
  }, 10_000);

  it("start review failure shows the refusal and re-reads", async () => {
    m.post.mockRejectedValue(new ApiError({ status: 409, code: "INVALID_TRANSITION", message: "That move is not allowed now." }));
    const changed = vi.fn();
    show({ l: { state: "draft" }, changed });
    expect((await screen.findByRole("alert")).textContent).toContain("That move is not allowed now.");
    expect(changed).toHaveBeenCalled();
    expect(screen.queryByTestId("reviewer-note")).toBeNull();
    cleanup();
    m.post.mockRejectedValue(new ApiError({ status: 503, code: "COLLAB_UNAVAILABLE", message: "x" }));
    show({ l: { state: "draft" } });
    expect((await screen.findByRole("alert")).textContent).toContain(COLLAB_DOWN);
  });

  it("refusals: COLLAB_UNAVAILABLE says nothing changed", async () => {
    m.post.mockRejectedValue(new ApiError({ status: 503, code: "COLLAB_UNAVAILABLE", message: "x" }));
    show();
    await userEvent.click(submitBtn());
    expect((await screen.findByRole("alert")).textContent).toContain(COLLAB_DOWN);
  });

  it("start review is sent once for a reviewer on a draft (also in StrictMode)", async () => {
    const changed = vi.fn();
    show({ l: { state: "draft" }, strict: true, changed });
    await waitFor(() => expect(screen.getByTestId("reviewer-note").textContent).toBe(REVIEWER_NOTE));
    expect(transitionBodies()).toEqual([{ action: "start_review" }]);
    expect(changed).toHaveBeenCalled();
  });

  it("start review is never sent for author or approver or a non-draft", async () => {
    for (const role of ["author", "approver"] as const) {
      show({ role, l: { state: "draft" } });
      cleanup();
    }
    show({ l: { state: "in_review" } });
    await new Promise((r) => setTimeout(r, 20));
    expect(m.post).not.toHaveBeenCalled();
  });

  it("frozen: submitted offers Withdraw only", () => {
    show({ l: { state: "submitted" } });
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Submit for approval/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Regenerate/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /AI assist|More/ })).toBeNull();
  });

  it("withdraw posts {action: withdraw} with no note", async () => {
    show({ l: { state: "submitted" } });
    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(transitionBodies()).toEqual([{ action: "withdraw" }]));
    expect(screen.getByText("Lesson 4 withdrawn. It's back in review.")).toBeTruthy();
  });

  it("approved offers History only", () => {
    show({ l: { state: "approved" } });
    expect(screen.getByRole("link", { name: "History" }).getAttribute("href")).toBe("/units/g6-u4/lessons/L4/history");
    expect(screen.queryAllByRole("button")).toHaveLength(1 /* the test's own card stub */);
  });

  it("generation_failed offers Regenerate as primary", () => {
    show({ l: { state: "generation_failed" } });
    expect(screen.getByRole("button", { name: /Regenerate/ }).getAttribute("data-variant")).toBe("primary");
    expect(screen.queryByRole("button", { name: /Submit for approval/ })).toBeNull();
  });

  it("regenerate sends the note, shows Drafting a candidate and then the SCR-12 link", async () => {
    m.post.mockResolvedValue({ data: { candidate_id: "cand-1", status: "drafting", failure_reasons: [] } });
    m.get
      .mockResolvedValueOnce({ data: { candidate_id: "cand-1", status: "drafting", failure_reasons: [] } })
      .mockResolvedValue({ data: { candidate_id: "cand-1", status: "ready", failure_reasons: [] } });
    show();
    await userEvent.click(screen.getByRole("button", { name: /Regenerate…/ }));
    await userEvent.type(screen.getByLabelText(/Note/), " shorter intro ");
    await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    await waitFor(() => expect(screen.getByTestId("regen-status").textContent).toBe(DRAFTING));
    expect(m.post).toHaveBeenCalledWith("/lessons/{lessonId}/candidates", { params: { path: { lessonId: "G6.U4.L4" } }, body: { note: "shorter intro" } });
    const link = await screen.findByRole("link", { name: "Compare the candidate" }, { timeout: 4000 });
    expect(link.getAttribute("href")).toBe("/units/g6-u4/lessons/L4/candidates/cand-1");
  }, 10_000);

  it("regenerate LESSON_LOCKED and DAY_CAP_REACHED sentences", async () => {
    for (const [code, text] of [["LESSON_LOCKED", REGEN_LOCKED], ["DAY_CAP_REACHED", REGEN_CAP]] as const) {
      m.post.mockRejectedValue(new ApiError({ status: 409, code, message: "x" }));
      show();
      await userEvent.click(screen.getByRole("button", { name: /Regenerate…/ }));
      await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));
      expect((await screen.findByRole("alert")).textContent).toContain(text);
      expect(m.post).toHaveBeenLastCalledWith("/lessons/{lessonId}/candidates", { params: { path: { lessonId: "G6.U4.L4" } } });
      cleanup();
    }
  });

  it("disclosure is always present", () => {
    for (const role of ["author", "reviewer", "approver"] as const) {
      show({ role, l: { state: "approved" } });
      expect(screen.getByText(DISCLOSURE)).toBeTruthy();
      cleanup();
    }
  });
});
