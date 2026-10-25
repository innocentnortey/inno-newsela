import type { LessonId, LessonStateName, OutlineVersionId, Sha256 } from "./common.ts";

export interface DependencyState {
  direction: "waits_on" | "depended_on_by";
  lesson_id: LessonId;
  slot_id: string;
  source_state: LessonStateName;
  slot_filled: boolean;
  source_approved_hash: Sha256 | null;
}

export interface LessonGraphRepo {
  dependencies(lesson_id: LessonId): Promise<DependencyState[]>;
  dependants(lesson_id: LessonId): Promise<LessonId[]>;
  // outline version of the run that produced the newest "generated" or wholly adopted "candidate" version; null if neither
  source_outline_version(lesson_id: LessonId): Promise<OutlineVersionId | null>;
}
