import type { CheckKind, IssueId, IssueLevelName, LessonId, RequestId, Sha256, UnitId, UserId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface CheckFinding {
  kind: CheckKind;
  level: IssueLevelName;
  message: string;
  address: string | null;
  span_anchor: string | null;
  related_lesson_id: LessonId | null;
  code: string | null;
}

export interface IssueRow {
  issue_id: IssueId;
  lesson_id: LessonId;
  content_hash: Sha256;
  level: IssueLevelName;
  kind: CheckKind;
  message: string;
  address: string | null;
  span_anchor: string | null;
  related_lesson_id: LessonId | null;
  code: string | null; // the standard code a finding is about (part of the resolution key)
  resolved_by: UserId | null;
  resolution_reason: string | null;
  resolved_at: Date | null;
  cleared_by: "fix" | "resolution" | null;
  created_at: Date;
}

export interface IssueSet {
  lesson_id: LessonId;
  checked_hash: Sha256 | null;
  checked_at: Date | null;
  issues: IssueRow[];
}

export interface NewResolution {
  issue_id: IssueId;
  by: UserId;
  reason: string;
  request_id: RequestId;
}

export interface LessonIssueCounts {
  lesson_id: LessonId;
  blocking: number;
  confirmation: number;
  advisory: number;
}

export interface IssueRepo {
  // carries resolutions forward to an identical finding (kind, address, code); marks the rest cleared_by "fix"
  replace_for_hash(lesson_id: LessonId, content_hash: Sha256, findings: readonly CheckFinding[], tx: Tx): Promise<IssueSet>;
  current(lesson_id: LessonId): Promise<IssueSet>;
  get(issue_id: IssueId): Promise<IssueRow | null>;
  resolve(r: NewResolution, tx: Tx): Promise<IssueRow>;
  // latest resolved row per (kind, address, code) on any hash of the lesson
  resolutions_for(lesson_id: LessonId): Promise<IssueRow[]>;
  counts_by_lesson(unit_id: UnitId): Promise<LessonIssueCounts[]>;
}
