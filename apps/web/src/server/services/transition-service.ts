// NL-53: TransitionService.transition (CON-18 precedence; DO-4 §5, §13 R-10).
// role -> NOT_FOUND -> decide_transition -> per action. The collaboration server alone writes content and the submit
// snapshot; approve is ApproveService (no collaboration hop); the unfreezing moves call set_mode(editable) INSIDE the
// open transaction as its last statement, so a collaboration failure rolls the move back.
import { CollabUnavailable, DomainRefusal, InvariantViolation } from "@ls/core/errors";
import { decide_transition, transition_roles, type TransitionAction } from "@ls/core/lifecycle/lesson-machine";
import type { CollabCommands } from "@ls/core/ports/collab-commands";
import type { LessonId, LessonStateName, RequestUser } from "@ls/core/ports/common";
import type { LessonRow, LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { LessonVersionRepo, LessonVersionRow } from "@ls/core/ports/lesson-versions";
import type { TxRunner } from "@ls/core/ports/tx";
import type { Logger } from "@ls/obs/logger";
import type { TransitionRequestInput, TransitionResult } from "@ls/schema/api/transition";
import type { ApproveApi } from "./approve-service.ts";

export interface TransitionApi {
  transition(user: RequestUser, lesson_id: LessonId, req: TransitionRequestInput): Promise<TransitionResult>;
}

type Moving = Exclude<TransitionRequestInput, { action: "submit" } | { action: "approve" }>;

function version_ref(v: LessonVersionRow): TransitionResult["version"] {
  // A version with no stored vector (a generated one) is reported with an empty vector.
  return { version_id: v.version_id, version_number: v.number, content_hash: v.content_hash, state_vector: v.state_vector ?? "" };
}

export class TransitionService implements TransitionApi {
  constructor(
    private readonly states: LessonStateRepo,
    private readonly versions: LessonVersionRepo,
    private readonly approvals: ApproveApi,
    private readonly collab: CollabCommands,
    private readonly tx: TxRunner,
    private readonly logger: Logger,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async transition(user: RequestUser, lesson_id: LessonId, req: TransitionRequestInput): Promise<TransitionResult> {
    const action: TransitionAction = req.action;
    if (!transition_roles(action).includes(user.role)) {
      throw new DomainRefusal("ROLE_FORBIDDEN", "Your role cannot do this.");
    }
    const row = await this.states.get(lesson_id);
    if (row === null) throw new DomainRefusal("NOT_FOUND", "Lesson not found.", { lesson_id });
    this.decide(user, row.state, req, lesson_id);

    switch (req.action) {
      case "submit":
        return this.submit(user, lesson_id, req.client_state_vector);
      case "approve":
        return this.approvals.approve(user, lesson_id, req);
      default:
        return this.move(user, lesson_id, req);
    }
  }

  private decide(user: RequestUser, from_state: LessonStateName, req: TransitionRequestInput, lesson_id: LessonId) {
    const d = decide_transition({
      action: req.action,
      role: user.role,
      from_state,
      note: "note" in req ? req.note : undefined,
      reason: "reason" in req ? req.reason : undefined,
      tag: "tag" in req ? req.tag : undefined,
      rating: "rating" in req ? req.rating : undefined,
    });
    if (!d.allowed) {
      throw new DomainRefusal(d.refusal ?? "INVALID_TRANSITION", "That move is not allowed now.", { lesson_id, state: from_state });
    }
    return d;
  }

  private async submit(user: RequestUser, lesson_id: LessonId, client_state_vector: string): Promise<TransitionResult> {
    try {
      const r = await this.collab.lock_and_snapshot({
        lesson_id,
        actor: { user_id: user.user_id, name: user.name, role: user.role, synthetic: user.synthetic },
        client_state_vector,
        request_id: user.request_id,
      } as never);
      return {
        lesson_id,
        from_state: r.from_state,
        to_state: r.to_state,
        version: {
          version_id: r.version_id,
          version_number: r.version_number,
          content_hash: r.content_hash,
          state_vector: r.state_vector,
        },
        audit_id: r.review_event_id,
      } as TransitionResult;
    } catch (e) {
      if (e instanceof CollabUnavailable) {
        throw new DomainRefusal("COLLAB_UNAVAILABLE", "The editing service is unavailable. Nothing changed.", { lesson_id });
      }
      throw e; // DomainRefusal from the collaboration server passes through unchanged
    }
  }

  private async move(user: RequestUser, lesson_id: LessonId, req: Moving): Promise<TransitionResult> {
    let mode_set = false;
    let from_state: LessonStateName | null = null;
    try {
      return await this.tx.with_tx(async (tx) => {
        const locked: LessonRow = await this.states.lock_for_update(lesson_id, tx);
        from_state = locked.state;
        const d = this.decide(user, locked.state, req, lesson_id);
        const to_state = d.to_state!;

        let version: LessonVersionRow;
        if (req.action === "reopen") {
          const src = await this.versions.latest_snapshot(lesson_id);
          if (src === null || src.kind !== "approve") throw new InvariantViolation("reopen_without_approved_snapshot", { lesson_id });
          version = await this.versions.write_snapshot(
            {
              lesson_id,
              kind: "reopen",
              lesson: src.lesson,
              content_hash: src.content_hash,
              state_vector: src.state_vector!,
              dependency_record: [],
              created_by: user.user_id,
            },
            tx,
          );
        } else {
          const cur =
            (await this.versions.latest_snapshot(lesson_id)) ??
            (locked.current_version_id === null ? null : await this.versions.version(locked.current_version_id));
          if (cur === null) throw new InvariantViolation("no_version_for_move", { lesson_id });
          version = cur;
        }

        // start_review records the acting reviewer; every other move keeps the lesson's reviewer.
        const reviewer_id = req.action === "start_review" ? user.user_id : locked.reviewer_id;
        await this.states.set_state(lesson_id, to_state, reviewer_id, tx);
        const ev = await this.states.append_review_event(
          {
            lesson_id,
            version_id: version.version_id,
            from_state: locked.state,
            to_state,
            actor_id: user.user_id,
            reason: req.action === "reopen" ? (req.reason ?? null) : null,
            reason_tag: req.action === "request_changes" ? req.tag : null,
            note: req.action === "withdraw" || req.action === "request_changes" ? (req.note ?? null) : null,
            content_hash: version.content_hash,
            request_id: user.request_id,
          },
          tx,
        );

        if (d.collab_mode_after === "editable") {
          // Last statement in the callback: a failure here rolls the whole move back.
          await this.collab.set_mode({ lesson_id, mode: "editable", state: to_state, request_id: user.request_id });
          mode_set = true;
        }
        return {
          lesson_id,
          from_state: locked.state,
          to_state,
          version: version_ref(version),
          audit_id: ev.review_event_id,
        } as TransitionResult;
      });
    } catch (e) {
      if (e instanceof CollabUnavailable) {
        throw new DomainRefusal("COLLAB_UNAVAILABLE", "The editing service is unavailable. Nothing changed.", { lesson_id });
      }
      if (mode_set && from_state !== null) {
        // The commit failed after the editor was unfrozen: freeze it again (3 attempts, short backoff).
        const frozen = await this.refreeze(user.request_id, lesson_id, from_state);
        this.logger.error(frozen ? "transition.commit_failed_after_set_mode" : "transition.refreeze_failed", {
          request_id: user.request_id,
          lesson_id,
          extra: new InvariantViolation(frozen ? "commit_failed_after_set_mode" : "refreeze_failed", { action: req.action }),
        });
        if (!frozen) {
          // The editor may still be editable while the database says otherwise: make that visible to the caller.
          throw new InvariantViolation("refreeze_failed", { lesson_id, action: req.action });
        }
      }
      throw e;
    }
  }

  private async refreeze(request_id: string, lesson_id: LessonId, state: LessonStateName): Promise<boolean> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.collab.set_mode({ lesson_id, mode: "read_only", state, request_id });
        return true;
      } catch {
        if (attempt < 3) await this.sleep(50 * attempt);
      }
    }
    return false;
  }
}
