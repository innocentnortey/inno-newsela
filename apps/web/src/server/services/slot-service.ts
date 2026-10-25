// SlotService (DO-4 section 5, CON-15 fillSlot). The web process validates, then hands ONE apply_edit to the
// collaboration server. It never writes lesson content, opens a transaction or writes an audit row (WF-12).
import type { Actor, LessonId, RequestUser } from "@ls/core/ports/common";
import type {
  CollabCommands,
  SlotFillEdit,
  StoreAck,
} from "@ls/core/ports/collab-commands";
import type { LessonGraphRepo } from "@ls/core/ports/lesson-graph";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { CheckPolicy } from "@ls/core/checks/types";
import { CollabUnavailable, DomainRefusal } from "@ls/core/errors";
import { is_editable } from "@ls/core/lifecycle/lesson-machine";
import type {
  FillSlotRequest,
  FillSlotResult,
  SourceRef,
} from "@ls/schema/api/lessons";

export interface SlotApi {
  fill(
    user: RequestUser,
    lesson_id: LessonId,
    slot_id: string,
    req: FillSlotRequest,
  ): Promise<FillSlotResult>;
}

// A token counts as a word only if it holds a letter or digit: "-", "..." and an em dash add nothing.
function count_words(text: string): number {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

// `book` cannot arrive over HTTP (the Zod mirror strips it) but the ticket names it, so a non-HTTP caller works.
function has_source(ref: SourceRef): boolean {
  const r = ref as unknown as Record<string, unknown>;
  return ["book", "title", "chapter", "pages", "url"].some((k) => {
    const v = r[k];
    return typeof v === "string" && v.trim() !== "";
  });
}

export class SlotService implements SlotApi {
  constructor(
    private readonly states: LessonStateRepo,
    private readonly collab: CollabCommands,
    private readonly policy: CheckPolicy,
    private readonly graph: LessonGraphRepo,
  ) {}

  async fill(
    user: RequestUser,
    lesson_id: LessonId,
    slot_id: string,
    req: FillSlotRequest,
  ): Promise<FillSlotResult> {
    if (user.role !== "reviewer")
      throw new DomainRefusal("ROLE_FORBIDDEN", "Your role cannot do this.");
    const row = await this.states.get(lesson_id);
    if (row === null)
      throw new DomainRefusal("NOT_FOUND", "Lesson not found.", { lesson_id });
    if (!is_editable(row.state, user.role)) {
      throw new DomainRefusal(
        "LESSON_LOCKED",
        "This lesson cannot be edited in its current state.",
        {
          lesson_id,
          state: row.state,
        },
      );
    }
    // Defence in depth: the route's schema already refuses these.
    if (req.text.trim() === "" || req.text.length > 10000) {
      throw new DomainRefusal("INVALID_REQUEST", "The request is not valid.", {
        fields: ["body.text"],
      });
    }
    if (!has_source(req.source_ref)) {
      throw new DomainRefusal(
        "SOURCE_REQUIRED",
        "A quote needs a source: a title, chapter, pages or link.",
        {
          lesson_id,
          slot_id,
        },
      );
    }
    const max = this.policy.reviewer_quote_max_words;
    if (
      req.rights_status === "short-quote-commentary" &&
      count_words(req.text) > max
    ) {
      throw new DomainRefusal(
        "QUOTE_TOO_LONG",
        `A short quote with commentary can be at most ${max} words.`,
        {
          lesson_id,
          slot_id,
          max_words: max,
        },
      );
    }

    const actor: Actor = {
      user_id: user.user_id,
      name: user.name,
      role: user.role,
      synthetic: user.synthetic,
    };
    // The text goes on verbatim: plain text is stored as typed (R-58).
    const edit: SlotFillEdit = {
      kind: "slot_fill",
      slot_id,
      text: req.text,
      source_ref: req.source_ref,
      rights_status: req.rights_status,
    };
    let ack: StoreAck;
    try {
      // No retry: commands are not idempotent.
      ack = await this.collab.apply_edit({
        lesson_id,
        actor,
        edit,
        tag: "slot-fill",
        request_id: user.request_id,
      });
    } catch (e) {
      if (e instanceof CollabUnavailable) {
        throw new DomainRefusal(
          "COLLAB_UNAVAILABLE",
          "The collaboration server could not apply the insert. Try again.",
          {
            lesson_id,
          },
        );
      }
      throw e; // a refusal from collab keeps its own code
    }

    const still_blocking = req.rights_status === "to-clear";
    const linked_lessons: FillSlotResult["linked_lessons"] = [];
    for (const dependant of await this.graph.dependants(lesson_id)) {
      const deps = await this.graph.dependencies(dependant);
      const link = deps.find(
        (d) =>
          d.direction === "waits_on" &&
          d.lesson_id === lesson_id &&
          d.slot_id === slot_id,
      );
      if (link === undefined) continue; // it waits on another slot of this lesson
      // The stored slot_filled flag may lag the store, so it is not trusted: this call just filled the slot.
      const approved =
        link.source_state === "approved" && link.source_approved_hash !== null;
      linked_lessons.push({
        lesson_id: dependant,
        status: approved ? "source_approved" : "waiting_for_source_approval",
      });
    }
    return {
      slot_id,
      inserted_by: user.name,
      inserted_at: ack.stored_at.toISOString(),
      content_hash: ack.content_hash,
      still_blocking,
      blocking_reason: still_blocking ? "rights to clear" : null,
      linked_lessons,
    };
  }
}
