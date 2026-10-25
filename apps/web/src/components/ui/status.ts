export type GlyphShape =
  | "circle-open"
  | "circle-dashed"
  | "circle-half"
  | "circle-back"
  | "circle-up"
  | "circle-check"
  | "circle-turn"
  | "square-out"
  | "square"
  | "triangle-bang"
  | "circle-half-wrench"
  | "circle-bang"
  | "circle-pause"
  | "octagon-bar"
  | "circle-i"
  | "diamond"
  | "none";

export type Tone =
  | "neutral-ink2"
  | "neutral-ink3"
  | "info"
  | "warn"
  | "success"
  | "danger"
  | "plain";

export type StatusKey =
  | "lesson.draft"
  | "lesson.in_review"
  | "lesson.changes_requested"
  | "lesson.submitted"
  | "lesson.approved"
  | "lesson.reopened"
  | "lesson.exported"
  | "lesson.generation_failed"
  | "tile.queued"
  | "tile.planning"
  | "tile.drafting"
  | "tile.checking"
  | "tile.repairing"
  | "tile.ready"
  | "tile.failed"
  | "run.planning"
  | "run.running"
  | "run.complete"
  | "run.partial"
  | "run.capped"
  | "run.paused"
  | "run.cancelled"
  | "issue.blocking"
  | "issue.confirmation"
  | "issue.advisory"
  | "issue.resolved"
  | "origin.outline"
  | "origin.outline-fixed"
  | "origin.narrowed"
  | "origin.added"
  | "validation.error"
  | "validation.warning"
  | "validation.ok";

export interface StatusSpec {
  label: string;
  glyph: GlyphShape;
  tone: Tone;
}

const s = (label: string, glyph: GlyphShape, tone: Tone): StatusSpec => ({ label, glyph, tone });

/** design.md §2, one entry per state. */
export const STATUS_SPECS: Record<StatusKey, StatusSpec> = {
  "lesson.draft": s("Draft", "circle-open", "neutral-ink2"),
  "lesson.in_review": s("In review", "circle-half", "info"),
  "lesson.changes_requested": s("Changes requested", "circle-back", "info"),
  "lesson.submitted": s("Submitted", "circle-up", "warn"),
  "lesson.approved": s("Approved", "circle-check", "success"),
  "lesson.reopened": s("Reopened", "circle-turn", "info"),
  "lesson.exported": s("Exported", "square-out", "success"),
  "lesson.generation_failed": s("Failed", "triangle-bang", "danger"),
  "tile.queued": s("Queued", "circle-dashed", "neutral-ink3"),
  "tile.planning": s("Planning", "circle-half", "info"),
  "tile.drafting": s("Drafting", "circle-half", "info"),
  "tile.checking": s("Checking", "circle-half", "info"),
  "tile.repairing": s("Repairing", "circle-half-wrench", "warn"),
  "tile.ready": s("Ready", "circle-check", "success"),
  "tile.failed": s("Failed", "triangle-bang", "danger"),
  "run.planning": s("Planning", "circle-half", "info"),
  "run.running": s("Running", "circle-half", "info"),
  "run.complete": s("Complete", "circle-check", "success"),
  "run.partial": s("Partial", "circle-bang", "warn"),
  "run.capped": s("Capped", "circle-bang", "warn"),
  "run.paused": s("Paused", "circle-pause", "warn"),
  "run.cancelled": s("Cancelled", "square", "neutral-ink2"),
  "issue.blocking": s("Blocking", "octagon-bar", "danger"),
  "issue.confirmation": s("Confirm", "octagon-bar", "danger"),
  "issue.advisory": s("Advisory", "circle-i", "warn"),
  "issue.resolved": s("Resolved", "circle-check", "success"),
  "origin.outline": s("from the outline", "none", "plain"),
  "origin.outline-fixed": s("outline, fixed", "none", "plain"),
  "origin.narrowed": s("AI-proposed", "diamond", "info"),
  "origin.added": s("confirm", "diamond", "info"),
  "validation.error": s("Error", "octagon-bar", "danger"),
  "validation.warning": s("Warning", "circle-i", "warn"),
  "validation.ok": s("OK", "circle-check", "success"),
};

export const STEPS = ["Draft", "In review", "Submitted", "Approved", "Exported"] as const;
