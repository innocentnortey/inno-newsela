// SuggestionService (NL-50, DO-4 section 5): list, request and decide an AI rewrite suggestion.
// Nothing AI-written enters a lesson until a reviewer accepts; the accept is applied by the collaboration
// server against the live document using the STORED selected text, never the browser's.
// The service writes no logs (D-14): selected text, suggested text, notes and prompts never leave it except
// through the store, the model call and the response.
import {
  CollabUnavailable,
  DomainRefusal,
  InvariantViolation,
  ProviderError,
  SpendRefused,
} from "@ls/core/errors";
import type { AuditLog, NewAuditEvent } from "@ls/core/ports/audit";
import type { Clock } from "@ls/core/ports/clock";
import type { CollabCommands } from "@ls/core/ports/collab-commands";
import type {
  LessonId,
  RequestId,
  RequestUser,
  RoleName,
  SuggestionId,
  UserId,
} from "@ls/core/ports/common";
import type { LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { RecordedCall } from "@ls/core/ports/model-call-log";
import type { StructuredCallRequest } from "@ls/core/ports/model-client";
import type { PromptRepo } from "@ls/core/ports/prompts";
import type { SuggestionRepo, SuggestionRow } from "@ls/core/ports/suggestions";
import type { TxRunner } from "@ls/core/ports/tx";
import { is_editable } from "@ls/core/lifecycle/lesson-machine";
import type { WebSettings } from "@ls/config/settings";
import { AssistRewrite } from "@ls/prompts/assist-rewrite";
import type { AssistPromptInput, RenderedPrompt } from "@ls/prompts/inputs";
import { SchemaRegistry } from "@ls/prompts/schemas";
import type {
  Suggestion,
  SuggestionDecisionRequest,
  SuggestionList,
  SuggestionRequest,
} from "@ls/schema/api/lessons";
import type { StoredLesson } from "@ls/schema/lesson";

export const AI_ACCEPT_ACTION = "suggestion.accept";
export const SUGGESTION_REQUEST_ACTION = "suggestion.request";
export const SUGGESTION_REJECT_ACTION = "suggestion.reject";
export const SELECTED_TEXT_MAX_CHARS = 2000;
export const NOTE_MAX_CHARS = 2000;
export const ANCHOR_MAX_CHARS = 1024;
export const SUGGESTED_TEXT_MAX_CHARS = 8000;
export const ASSIST_MAX_OUTPUT_TOKENS = 2048;

const ASSIST_SCHEMA = new SchemaRegistry().json_schema("AssistRewrite");
const UNAVAILABLE_MESSAGE = "The AI assist is unavailable right now. Nothing was changed.";

export interface AssistModelCtx {
  run_id: null;
  lesson_id: LessonId;
  job_id: null;
  attempt: number;
  purpose: "assist";
  request_id: RequestId | null;
  experiment_id: null;
  reservation_id: null;
}
export interface AssistPaidCallRequest {
  ctx: AssistModelCtx;
  req: StructuredCallRequest;
  rendered: RenderedPrompt;
  run_id: null;
  job_id: null;
  user_id: UserId;
}
export interface AssistPaidCaller {
  call(p: AssistPaidCallRequest): Promise<RecordedCall>;
}
export interface AssistRenderer {
  render_assist(i: AssistPromptInput): RenderedPrompt;
}
export interface SuggestionApi {
  list_pending(user: RequestUser, lesson_id: LessonId): Promise<SuggestionList>;
  request(user: RequestUser, lesson_id: LessonId, req: SuggestionRequest): Promise<Suggestion>;
  decide(
    user: RequestUser,
    lesson_id: LessonId,
    suggestion_id: SuggestionId,
    req: SuggestionDecisionRequest,
  ): Promise<Suggestion>;
}

/** Map a stored row to the API shape (D-13). `content_hash` is set only in the accept response. */
export function to_api(row: SuggestionRow, content_hash: string | null): Suggestion {
  return {
    suggestion_id: row.suggestion_id,
    status: row.status,
    anchor: { start: row.anchor_start, end: row.anchor_end },
    selected_text: row.selected_text,
    suggested_text: row.suggested_text,
    requested_by: row.requested_by,
    expires_at: row.expires_at.toISOString(),
    decided_by: row.decided_by,
    content_hash,
  };
}

const squash = (s: string): string => s.replace(/\s+/g, " ").trim();

function text_of(node: unknown): string {
  if (typeof node !== "object" || node === null) return "";
  const n = node as { type?: unknown; text?: unknown; content?: unknown };
  if (n.type === "text") return typeof n.text === "string" ? n.text : "";
  if (!Array.isArray(n.content)) return "";
  // Inline text concatenates; block children are separated by a space.
  const inline = n.content.every((c) => (c as { type?: unknown } | null)?.type === "text");
  return n.content.map(text_of).join(inline ? "" : " ");
}

/** Plain text of a ProseMirror doc: text nodes concatenated, blocks joined by a space, whitespace collapsed. */
export function flatten_text(doc: unknown): string {
  return squash(text_of(doc));
}

/** The name of the first section whose text contains the selection (D-10); "Lesson" when none does. */
export function section_name_for(lesson: StoredLesson, selected: string): string {
  const needle = squash(selected);
  if (needle === "") return "Lesson";
  for (const s of lesson.sections) {
    if (flatten_text(s.content).includes(needle)) return s.name;
  }
  return "Lesson";
}

const forbid_role = (): DomainRefusal =>
  new DomainRefusal("ROLE_FORBIDDEN", "Your role cannot do this.");
const not_found_lesson = (lesson_id: LessonId): DomainRefusal =>
  new DomainRefusal("NOT_FOUND", "Lesson not found.", { lesson_id });
const not_found_suggestion = (suggestion_id: SuggestionId): DomainRefusal =>
  new DomainRefusal("NOT_FOUND", "Suggestion not found.", { suggestion_id });
const invalid_field = (field: string): DomainRefusal =>
  new DomainRefusal("INVALID_REQUEST", "The request is not valid.", { fields: [field] });
const unavailable = (reason: string): DomainRefusal =>
  new DomainRefusal("MODEL_UNAVAILABLE", UNAVAILABLE_MESSAGE, { reason });

export class SuggestionService implements SuggestionApi {
  private readonly in_flight = new Set<string>();

  constructor(
    private readonly paid: AssistPaidCaller,
    private readonly renderer: AssistRenderer,
    private readonly prompts: PromptRepo,
    private readonly suggestions: SuggestionRepo,
    private readonly states: LessonStateRepo,
    private readonly collab: CollabCommands,
    private readonly audit: AuditLog,
    private readonly tx: TxRunner,
    private readonly clock: Clock,
    private readonly settings: Pick<WebSettings, "assist_call_timeout_ms" | "suggestion_ttl_min">,
    private readonly reader: LessonDocReader,
  ) {}

  async list_pending(user: RequestUser, lesson_id: LessonId): Promise<SuggestionList> {
    const roles: RoleName[] = ["author", "reviewer", "approver"];
    if (!roles.includes(user.role)) throw forbid_role();
    if ((await this.states.get(lesson_id)) === null) throw not_found_lesson(lesson_id);
    const rows = await this.suggestions.pending_for(lesson_id, this.clock.now());
    return { suggestions: rows.map((r) => to_api(r, null)) };
  }

  async request(
    user: RequestUser,
    lesson_id: LessonId,
    req: SuggestionRequest,
  ): Promise<Suggestion> {
    if (user.role !== "reviewer") throw forbid_role();
    this.validate(req);

    const lesson = await this.states.get(lesson_id);
    if (lesson === null) throw not_found_lesson(lesson_id);
    if (!is_editable(lesson.state, "reviewer")) {
      throw new DomainRefusal("LESSON_LOCKED", "This lesson is locked.", { state: lesson.state });
    }

    const derived = await this.reader.latest_derived(lesson_id);
    const section_name =
      derived === null ? "Lesson" : section_name_for(derived.lesson, req.selected_text);
    const prompt = await this.prompts.current();
    const rendered = this.renderer.render_assist({
      prompt,
      selected_text: req.selected_text,
      note: req.note,
      section_name,
    });

    let recorded: RecordedCall;
    try {
      recorded = await this.paid.call({
        ctx: {
          run_id: null,
          lesson_id,
          job_id: null,
          attempt: 1,
          purpose: "assist",
          request_id: user.request_id,
          experiment_id: null,
          reservation_id: null,
        },
        req: {
          alias: "ASSIST",
          system_blocks: rendered.system_blocks,
          user_blocks: rendered.user_blocks,
          output_schema_name: "AssistRewrite",
          output_json_schema: ASSIST_SCHEMA,
          output_mode: "schema_enforced",
          max_output_tokens: ASSIST_MAX_OUTPUT_TOKENS,
          timeout_ms: this.settings.assist_call_timeout_ms,
          effort: null,
          temperature: null,
        },
        rendered,
        run_id: null,
        job_id: null,
        user_id: user.user_id,
      });
    } catch (e) {
      if (e instanceof SpendRefused) throw unavailable("spend_cap");
      if (e instanceof ProviderError) throw unavailable("provider_error");
      throw e;
    }

    const suggested_text = this.parse_output(recorded.raw_output);
    const stored = await this.suggestions.insert({
      lesson_id,
      anchor_start: req.anchor.start,
      anchor_end: req.anchor.end,
      selected_text: req.selected_text,
      note: req.note,
      suggested_text,
      requested_by: user.user_id,
      model_call_id: recorded.model_call_id,
      expires_at: new Date(this.clock.now().getTime() + this.settings.suggestion_ttl_min * 60_000),
    });
    // Port gap R-1: insert has no tx parameter, so this audit cannot share its transaction.
    await this.tx.with_tx((t) =>
      this.audit.append(
        this.event(user, SUGGESTION_REQUEST_ACTION, stored.suggestion_id, {
          lesson_id,
          model_call_id: recorded.model_call_id,
        }),
        t,
      ),
    );
    return to_api(stored, null);
  }

  async decide(
    user: RequestUser,
    lesson_id: LessonId,
    suggestion_id: SuggestionId,
    req: SuggestionDecisionRequest,
  ): Promise<Suggestion> {
    if (user.role !== "reviewer") throw forbid_role();
    if ((await this.states.get(lesson_id)) === null) throw not_found_lesson(lesson_id);
    const row = await this.suggestions.get(suggestion_id);
    if (row === null || row.lesson_id !== lesson_id) throw not_found_suggestion(suggestion_id);
    if (row.status !== "pending") {
      throw new DomainRefusal("INVALID_TRANSITION", "This suggestion was already decided.", {
        suggestion_id,
        status: row.status,
      });
    }
    if (this.in_flight.has(suggestion_id)) {
      throw new DomainRefusal("INVALID_TRANSITION", "This suggestion is being decided.", {
        suggestion_id,
      });
    }
    this.in_flight.add(suggestion_id);
    try {
      if (req.decision === "reject") {
        const rejected = await this.tx.with_tx(async (t) => {
          const r = await this.suggestions.decide(suggestion_id, "rejected", user.user_id, t);
          await this.audit.append(
            this.event(user, SUGGESTION_REJECT_ACTION, suggestion_id, { lesson_id }),
            t,
          );
          return r;
        });
        return to_api(rejected, null);
      }
      return await this.accept(user, lesson_id, row);
    } finally {
      this.in_flight.delete(suggestion_id);
    }
  }

  private async accept(
    user: RequestUser,
    lesson_id: LessonId,
    row: SuggestionRow,
  ): Promise<Suggestion> {
    const suggestion_id = row.suggestion_id;
    let ack;
    try {
      // The stored selected text is the expectation; req.anchored_text_now is never read.
      ack = await this.collab.apply_edit({
        lesson_id,
        actor: {
          user_id: user.user_id,
          name: user.name,
          role: user.role,
          synthetic: user.synthetic,
        },
        edit: {
          kind: "suggestion_accept",
          suggestion_id,
          anchor: { start: row.anchor_start, end: row.anchor_end },
          expected_text: row.selected_text,
          replacement_text: row.suggested_text,
        },
        tag: "ai-assist",
        request_id: user.request_id,
      });
    } catch (e) {
      if (e instanceof DomainRefusal && e.code === "ANCHOR_CHANGED") {
        try {
          await this.tx.with_tx((t) =>
            this.suggestions.decide(suggestion_id, "closed", user.user_id, t),
          );
        } catch (inner) {
          if (!(inner instanceof InvariantViolation)) throw inner;
        }
        throw new DomainRefusal(
          "ANCHOR_CHANGED",
          "The text changed since the suggestion was made. Ask again.",
          { suggestion_id },
        );
      }
      if (e instanceof CollabUnavailable) {
        throw new DomainRefusal("COLLAB_UNAVAILABLE", "The editing service is busy. Try again.", {});
      }
      throw e;
    }
    // R-2: if expiry passes between apply_edit and this decide, InvariantViolation propagates.
    const accepted = await this.tx.with_tx(async (t) => {
      const r = await this.suggestions.decide(suggestion_id, "accepted", user.user_id, t);
      await this.audit.append(
        {
          ...this.event(user, AI_ACCEPT_ACTION, suggestion_id, {
            lesson_id,
            model_call_id: row.model_call_id,
          }),
          version_hash: ack.content_hash,
          store_id: ack.store_id,
        },
        t,
      );
      return r;
    });
    return to_api(accepted, ack.content_hash);
  }

  private validate(req: SuggestionRequest): void {
    const bad = (s: unknown, min: number, max: number): boolean =>
      typeof s !== "string" || s.length < min || s.length > max || s.includes("\u0000");
    if (bad(req.selected_text, 1, SELECTED_TEXT_MAX_CHARS)) throw invalid_field("selected_text");
    if (bad(req.note, 0, NOTE_MAX_CHARS)) throw invalid_field("note");
    if (
      typeof req.anchor !== "object" ||
      req.anchor === null ||
      bad(req.anchor.start, 1, ANCHOR_MAX_CHARS) ||
      bad(req.anchor.end, 1, ANCHOR_MAX_CHARS)
    ) {
      throw invalid_field("anchor");
    }
  }

  private parse_output(raw: string): string {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw unavailable("bad_output");
    }
    const parsed = AssistRewrite.safeParse(json);
    if (!parsed.success) throw unavailable("bad_output");
    const text = parsed.data.suggested_text;
    if (text.trim() === "" || text.length > SUGGESTED_TEXT_MAX_CHARS || text.includes("\u0000")) {
      throw unavailable("bad_output");
    }
    return text;
  }

  private event(
    user: RequestUser,
    action: string,
    suggestion_id: SuggestionId,
    details: Record<string, string>,
  ): NewAuditEvent {
    return {
      actor_id: user.user_id,
      action,
      target_kind: "suggestion",
      target_id: suggestion_id,
      version_hash: null,
      reason: null,
      details,
      request_id: user.request_id,
      store_id: null,
    };
  }
}
