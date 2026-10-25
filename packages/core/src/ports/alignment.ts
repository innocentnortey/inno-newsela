import type { LessonId, Sha256, UnitId, UserId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface AlignmentLinkRow {
  lesson_id: LessonId;
  content_hash: Sha256;
  code: string;
  address: string;
  role: "I" | "P" | "A";
  origin: "outline" | "narrowed" | "added";
  asserted_by: "outline" | "generator" | "judge" | "reviewer";
  confirmed_by: UserId | null;
}

export interface CoverageCell {
  code: string;
  lesson_id: LessonId;
  role: "I" | "P" | "A";
  confirmation: "person" | "judge_only" | "generator_only";
  // the latest approved snapshot's links where one exists, else the stored derived row's
  source: "approved" | "working";
}

export interface AlignmentRepo {
  replace_for_hash(lesson_id: LessonId, content_hash: Sha256, links: readonly AlignmentLinkRow[], tx: Tx): Promise<number>;
  confirm(lesson_id: LessonId, code: string, by: UserId, decision: "confirm" | "remove" | "add", tx: Tx): Promise<AlignmentLinkRow>;
  for_lesson(lesson_id: LessonId): Promise<AlignmentLinkRow[]>;
  // ONE query; never a model
  coverage_rows(unit_id: UnitId): Promise<CoverageCell[]>;
  // undo: replaces the rows for (lesson_id, code) at the latest hash with `rows`; returns the row count
  restore(lesson_id: LessonId, code: string, rows: readonly AlignmentLinkRow[], tx: Tx): Promise<number>;
}
