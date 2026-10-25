import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RowNote } from "@/features/board/row-note";
import type { components } from "@/lib/api-types";

type BoardRow = components["schemas"]["BoardRow"];
const row = (over: Partial<BoardRow>): BoardRow => ({
  lesson_id: "G6.U4.L4",
  lesson_key: "L4",
  number: 4,
  title: "Lesson 4",
  type: "Reading",
  state: "draft",
  blocking_count: 0,
  confirmation_count: 0,
  advisory_count: 0,
  reviewer: null,
  last_change_at: "2026-10-25T15:00:00Z",
  dependency_flags: [],
  send_back: null,
  judge_flag: null,
  ...over,
});
const show = (r: BoardRow, role: "author" | "reviewer" = "reviewer", runId: string | null = "run-0001") =>
  render(<RowNote row={r} unitKey="g6-u4" role={role} runId={runId} />);

afterEach(cleanup);

describe("RowNote", () => {
  it("slot empty", () => {
    show(row({ dependency_flags: [{ kind: "waits_on", status: "slot_empty", lesson_id: "G6.U4.L5", label: "x" }] }));
    expect(screen.getByText("Waits on Lesson 5's excerpt")).toBeTruthy();
  });
  it("waiting for approval", () => {
    show(row({ dependency_flags: [{ kind: "waits_on", status: "waiting_for_source_approval", lesson_id: "G6.U4.F2", label: "x" }] }));
    expect(screen.getByText("Waits on Flex day 2's approval")).toBeTruthy();
  });
  it("reopened", () => {
    show(row({ dependency_flags: [{ kind: "source_reopened", status: null, lesson_id: "G6.U4.L2", label: "x" }] }));
    expect(screen.getByText("A lesson this depends on was reopened")).toBeTruthy();
  });
  it("send back tag", () => {
    show(row({ send_back: { tag: "content_safety", note: "secret note", by: "Approver (demo)", at: "2026-10-25T15:00:00Z" } }));
    expect(screen.getByText("Content safety")).toBeTruthy();
    expect(screen.getByText("Changes requested by Approver (demo)")).toBeTruthy();
    expect(screen.queryByText(/secret note/)).toBeNull();
  });
  it("judge", () => {
    show(row({ judge_flag: { verdict: "no", label: "ignored" } }));
    expect(screen.getByText("Judge: no · provisional, not expert")).toBeTruthy();
  });
  it("failed retry only for author", () => {
    const failed = row({ state: "generation_failed" });
    const { unmount } = show(failed, "reviewer");
    expect(screen.getByText("Generation failed")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Retry" })).toBeNull();
    unmount();
    show(failed, "author");
    expect(screen.getByRole("link", { name: "Retry" }).getAttribute("href")).toBe("/units/g6-u4/runs/run-0001");
  });
  it("no notes shows dash", () => {
    show(row({}));
    expect(screen.getByText("—")).toBeTruthy();
  });
});
