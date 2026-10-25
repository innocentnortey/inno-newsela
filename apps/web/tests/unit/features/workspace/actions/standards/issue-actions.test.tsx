import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IssueActions } from "@/features/workspace/actions/standards/issue-actions";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";
import { renderWithSession } from "@/test-utils/render-with-session";

const post = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  api: { GET: get, POST: post },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/lessons/G6.U4.L4" }));

type Issue = components["schemas"]["Issue"];
const ADDR = "G6.U4.L4.LearningInAction.PartA";
const lesson = {
  lesson_id: "G6.U4.L4",
  state: "in_review",
  sections: [{ address: ADDR, name: "Part A", minutes: 15, content: { type: "doc", content: [{ type: "quote_placeholder", attrs: { slot_id: "s1", reason: "Add a quote" } }] } }],
} as never;
const mk = (o: Partial<Issue>): Issue => ({
  issue_id: "i1", level: "blocking", blocks: ["submit"], resolvable: true, kind: "quote_placeholder_open", message: "m", address: ADDR, span_anchor: null, related_lesson_id: null, resolution: null, ...o,
});
const show = (issue: Issue, role: Role, onChanged = vi.fn()) => {
  renderWithSession(<IssueActions issue={issue} lesson={lesson} issues={{ issues: [issue] } as never} onChanged={onChanged} />, role);
  return onChanged;
};
const click = async (name: RegExp | string) =>
  act(async () => {
    fireEvent.click(await screen.findByRole("button", { name }));
  });

beforeEach(() => {
  post.mockReset().mockResolvedValue({ data: { audit_id: "a1", slot_id: "s1", still_blocking: false, linked_lessons: [] } });
  get.mockReset().mockResolvedValue({ data: lesson });
});
afterEach(cleanup);

describe("IssueActions", () => {
  it("resolve_opens_dialog_for_reviewer", async () => {
    show(mk({ kind: "minutes_out_of_range", address: null }), "reviewer");
    await click("Resolve…");
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
  it("clear_flag_for_approver_not_resolve", async () => {
    show(mk({ kind: "safety_flag_open", resolvable: true, message: "Safety note sf:G6.U4.L4:9 is open: x" }), "approver");
    expect(screen.queryByRole("button", { name: "Resolve…" })).toBeNull();
    await click("Clear flag…");
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
  it("hides Clear flag when the flag id cannot be read", () => {
    show(mk({ kind: "safety_flag_open", message: "no id here" }), "reviewer");
    expect(screen.queryByRole("button", { name: "Clear flag…" })).toBeNull();
  });
  it("author_sees_no_actions", () => {
    show(mk({}), "author");
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("insert_quote_button_for_slot_issue", async () => {
    show(mk({ resolvable: false }), "reviewer");
    await click("Insert quote or excerpt…");
    expect(await screen.findByRole("dialog", { name: "Insert quote" })).toBeTruthy();
  });
  it("dialog_closes_and_rereads_on_resolved", async () => {
    const changed = show(mk({ kind: "minutes_out_of_range", address: null }), "reviewer");
    await click("Resolve…");
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Reviewed and fine" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Record resolution" }));
    });
    expect(post).toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("on_filled_rereads", async () => {
    const changed = show(mk({ resolvable: false }), "reviewer");
    await click("Insert quote or excerpt…");
    fireEvent.change(await screen.findByLabelText("Text"), { target: { value: "A short line" } });
    fireEvent.change(screen.getByLabelText("Book or title"), { target: { value: "Synthetic Reader" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    });
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
