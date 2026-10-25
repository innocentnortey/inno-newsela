import type { LessonStateRepo } from "../ports/lesson-state.ts";
import { Script } from "./scripted.ts";

export class FakeLessonStateRepo implements LessonStateRepo {
  readonly script = new Script<LessonStateRepo>();

  async get(...args: Parameters<LessonStateRepo["get"]>): Promise<Awaited<ReturnType<LessonStateRepo["get"]>>> {
    return this.script.take("get", args) as Awaited<ReturnType<LessonStateRepo["get"]>>;
  }
  async lock_for_update(...args: Parameters<LessonStateRepo["lock_for_update"]>): Promise<Awaited<ReturnType<LessonStateRepo["lock_for_update"]>>> {
    return this.script.take("lock_for_update", args) as Awaited<ReturnType<LessonStateRepo["lock_for_update"]>>;
  }
  async state_of(...args: Parameters<LessonStateRepo["state_of"]>): Promise<Awaited<ReturnType<LessonStateRepo["state_of"]>>> {
    return this.script.take("state_of", args) as Awaited<ReturnType<LessonStateRepo["state_of"]>>;
  }
  async ensure_lessons(...args: Parameters<LessonStateRepo["ensure_lessons"]>): Promise<Awaited<ReturnType<LessonStateRepo["ensure_lessons"]>>> {
    return this.script.take("ensure_lessons", args) as Awaited<ReturnType<LessonStateRepo["ensure_lessons"]>>;
  }
  async set_state(...args: Parameters<LessonStateRepo["set_state"]>): Promise<Awaited<ReturnType<LessonStateRepo["set_state"]>>> {
    return this.script.take("set_state", args) as Awaited<ReturnType<LessonStateRepo["set_state"]>>;
  }
  async append_review_event(...args: Parameters<LessonStateRepo["append_review_event"]>): Promise<Awaited<ReturnType<LessonStateRepo["append_review_event"]>>> {
    return this.script.take("append_review_event", args) as Awaited<ReturnType<LessonStateRepo["append_review_event"]>>;
  }
  async record_last_editor(...args: Parameters<LessonStateRepo["record_last_editor"]>): Promise<Awaited<ReturnType<LessonStateRepo["record_last_editor"]>>> {
    return this.script.take("record_last_editor", args) as Awaited<ReturnType<LessonStateRepo["record_last_editor"]>>;
  }
}
