# S-17 · SCR-9 live editor made visible (2026-10-25)

**Changed.** `workspace-screen.tsx` now renders `LessonEditor` in place of `LessonText` when `!isReadOnly(role, state)` (reviewer on draft, in_review, changes_requested, reopened); everyone else keeps `LessonText`. The hidden `editor-mount` is gone. `viewer` (user id, name, role) and `onPresence` are passed; the editor's own presence sentence shows who is here, and the count is on `data-others-present`. `onClientState` still feeds the action bar. `lesson-editor.tsx` section wrappers gained `id="sec-<address>"` and `data-address`.

**Why.** The edit screen was not visible in the product (seam S-17).

**Checked.** New unit test `editor-integration.test.tsx` (3 cases); workspace unit folder 62 passed; eslint and tsc clean; e2e workspace-read, workspace-editor, workspace-actions: 92 passed. workspace-read specs now open as author (or reviewer for banners) because a reviewer on an editable lesson no longer sees `lesson-text`.

**Remaining.** Jumps (outline, issue card, `?at=`) focus the section wrapper in the editor, not a text span or quote slot (`[data-text-region]` and `data-node` slots do not exist in the editor DOM). Per-section presence initials in the outline are not wired.
