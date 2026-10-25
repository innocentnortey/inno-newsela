import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithSession } from "@/test-utils/render-with-session";
import { ISSUES4, LESSON4 } from "../../../../e2e/workspace-read/fixtures";

const lessonState = vi.hoisted(() => ({ state: "in_review" as string }));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/features/workspace/use-lesson", () => ({
  useLesson: () => ({ load: { kind: "ready", lesson: { ...LESSON4, state: lessonState.state } }, retry: () => {} }),
  useIssues: () => ({ data: ISSUES4, error: undefined, retry: () => {} }),
}));
vi.mock("@/features/workspace/actions/use-review-heartbeat", () => ({ useReviewHeartbeat: () => {} }));
vi.mock("@/features/workspace/actions/action-bar", () => ({ WorkspaceActionBar: () => null }));
vi.mock("@/features/workspace/rail/evidence-rail", () => ({ EvidenceRail: () => null }));
vi.mock("@/editor/lesson-editor", () => ({ LessonEditor: () => <div data-testid="lesson-editor" /> }));

import { WorkspaceScreen } from "@/features/workspace/workspace-screen";

afterEach(cleanup);

function show(role: "reviewer" | "author" | "approver", state: string) {
  lessonState.state = state;
  renderWithSession(<WorkspaceScreen unitKey="u-1" lessonKey="l-1" />, role);
}

describe("SCR-9 editor integration (S-17)", () => {
  it("editable_reviewer_sees_editor_not_read_view", () => {
    show("reviewer", "in_review");
    expect(screen.getByTestId("lesson-editor")).toBeTruthy();
    expect(screen.queryByTestId("lesson-text")).toBeNull();
    expect(screen.queryByTestId("editor-mount")).toBeNull();
  });
  it("author_sees_read_view", () => {
    show("author", "in_review");
    expect(screen.getByTestId("lesson-text")).toBeTruthy();
    expect(screen.queryByTestId("lesson-editor")).toBeNull();
  });
  it("reviewer_on_approved_lesson_sees_read_view", () => {
    show("reviewer", "approved");
    expect(screen.getByTestId("lesson-text")).toBeTruthy();
    expect(screen.queryByTestId("lesson-editor")).toBeNull();
  });
});
