// In-memory freeze flags for the documents this process serves (PD-9: one process). Fails closed.
import { is_editable } from "@ls/core/lifecycle/lesson-machine";
import type { LessonId, LessonStateName } from "@ls/core/ports/common";

export class FrozenDocs {
  readonly #frozen = new Map<LessonId, boolean>();

  /** An unseeded lesson counts as frozen: nothing may be written until the first connection has read its state. */
  is_frozen(lesson_id: LessonId): boolean {
    return this.#frozen.get(lesson_id) ?? true;
  }
  freeze(lesson_id: LessonId): void {
    this.#frozen.set(lesson_id, true);
  }
  unfreeze(lesson_id: LessonId): void {
    this.#frozen.set(lesson_id, false);
  }
  /** First connection only: a freeze that arrived before the first connect wins over the database state. */
  seed(lesson_id: LessonId, state: LessonStateName): void {
    if (this.#frozen.has(lesson_id)) return;
    this.#frozen.set(lesson_id, !is_editable(state, "reviewer"));
  }
  /** On document unload, so a reload reseeds from the database. */
  forget(lesson_id: LessonId): void {
    this.#frozen.delete(lesson_id);
  }
}
