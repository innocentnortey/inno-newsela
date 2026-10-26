// LessonReadService (DO-4 section 5): read-only. No transaction, no write, no audit row, no clock, no logger.
import type { AlignmentLinkRow, AlignmentRepo } from "@ls/core/ports/alignment";
import type { AuditLog, HistoryRow } from "@ls/core/ports/audit";
import type { LessonId, LessonStateName, RequestUser } from "@ls/core/ports/common";
import type { IssueRepo, IssueRow } from "@ls/core/ports/issues";
import type { LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { DependencyState, LessonGraphRepo } from "@ls/core/ports/lesson-graph";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { LessonVersionRepo, LessonVersionRow, ProvenanceRecord } from "@ls/core/ports/lesson-versions";
import type { OutlineRepo } from "@ls/core/ports/outlines";
import type { SafetyFlagRepo } from "@ls/core/ports/safety-flags";
import type { SuggestionRepo } from "@ls/core/ports/suggestions";
import { DomainRefusal, InvariantViolation } from "@ls/core/errors";
import { decide_transition, transition_roles, type TransitionAction } from "@ls/core/lifecycle/lesson-machine";
import { assert_known_nodes, SchemaUnknownError, type ProseMirrorDoc as PMJson } from "@ls/editor-schema/schema";
import type { Lesson, Standard, TextCard, AlignmentEntry, ChecklistItem, Dependency } from "@ls/schema/api/lessons";
import type { LessonHistory } from "@ls/schema/api/review";
import type { Segment } from "@ls/schema/api/outlines";
import { SendBackTag, type SendBack } from "@ls/schema/api/board";
import type { StoredLesson } from "@ls/schema/lesson";

/** Seam NL-44 needs (plan R1): not on LessonVersionRepo yet. Oldest first by `number`. */
export interface LessonVersionLister {
  list_for_lesson(lesson_id: LessonId): Promise<LessonVersionRow[]>;
}

export interface LessonReadApi {
  get_lesson_traced(user: RequestUser, lesson_id: LessonId): Promise<{ lesson: Lesson; version_id: string | null }>;
  history(user: RequestUser, lesson_id: LessonId): Promise<LessonHistory>;
}

/** The audit action NL-50/NL-116 must write when a reviewer accepts an AI suggestion (plan R8). */
export const AI_ACCEPT_ACTION = "suggestion.accept";

const FROZEN: ReadonlySet<LessonStateName> = new Set(["submitted", "approved", "exported"]);
const CHECKLIST_STATES: ReadonlySet<LessonStateName> = new Set([
  "submitted",
  "changes_requested",
  "approved",
  "reopened",
  "exported",
]);
const NO_HASH = "0".repeat(64);
const ACTIONS: readonly TransitionAction[] = ["start_review", "submit", "withdraw", "approve", "request_changes", "reopen"];
const QUOTE_KINDS = new Set(["quote_placeholder_open", "excerpt_slot_open", "rights_to_clear", "quote_without_source"]);

type Asserted = Standard["asserted_by"];

interface Source {
  content: StoredLesson;
  hash: string;
  vector: string;
  schema_version: number;
  version_number: number;
  version_id: string | null;
  snapshot: Lesson["snapshot"];
  ai_spans: number;
}

export class LessonReadService implements LessonReadApi {
  constructor(
    private readonly states: LessonStateRepo,
    private readonly versions: LessonVersionRepo & LessonVersionLister,
    private readonly reader: LessonDocReader,
    private readonly outlines: OutlineRepo,
    private readonly alignment: AlignmentRepo,
    private readonly suggestions: SuggestionRepo,
    private readonly audit: AuditLog,
    private readonly issues: IssueRepo,
    private readonly flags: SafetyFlagRepo,
    private readonly graph: LessonGraphRepo,
  ) {
    void this.suggestions;
  }

  async get_lesson(user: RequestUser, lesson_id: LessonId): Promise<Lesson> {
    return (await this.get_lesson_traced(user, lesson_id)).lesson;
  }

  async get_lesson_traced(user: RequestUser, lesson_id: LessonId): Promise<{ lesson: Lesson; version_id: string | null }> {
    const row = await this.states.get(lesson_id);
    if (row === null) throw new DomainRefusal("NOT_FOUND", "Lesson not found.", { lesson_id });

    const src = await this.source(row.state, row.current_version_id, lesson_id);
    this.check_schema(src.content, src.schema_version, lesson_id);

    const [links, ov, dep_states, issue_set, open_flags, history] = await Promise.all([
      this.alignment.for_lesson(lesson_id),
      this.graph.source_outline_version(lesson_id),
      this.graph.dependencies(lesson_id),
      this.issues.current(lesson_id),
      this.flags.open_for(lesson_id),
      row.state === "changes_requested" ? this.audit.history(lesson_id) : Promise.resolve([] as HistoryRow[]),
    ]);

    const current_links = links.filter((l) => l.content_hash === src.hash);
    const standards = merge_standards(src.content.front_matter.standards, current_links);
    const text_cards = src.content.text_cards.map(to_text_card);
    const dependencies = dep_states.map(to_dependency);

    let outline_row: Lesson["outline_row"] = { row_number: 0, segments: [] };
    if (ov !== null) {
      const rec = (await this.outlines.rows(ov)).find((r) => r.row.lesson_id === lesson_id);
      if (rec !== undefined) {
        outline_row = {
          row_number: rec.row.row_number,
          segments: rec.row.segments.map(
            (s, i): Segment => ({
              segment_id: `${ov}.r${rec.row.row_number}.s${i}`,
              column: s.kind,
              kind: s.kind,
              text: s.text,
              action: s.applies,
              source: "default",
              by: null,
            }),
          ),
        };
      }
    }

    let send_back: SendBack | null = null;
    if (row.state === "changes_requested") {
      const hits = history.filter((h) => h.to_state === "changes_requested");
      const newest = hits.reduce<HistoryRow | null>((a, h) => (a === null || h.at > a.at ? h : a), null);
      if (newest !== null) {
        const parsed = SendBackTag.safeParse(newest.reason_tag);
        send_back = {
          tag: parsed.success ? parsed.data : "other",
          note: newest.note ?? newest.reason ?? "",
          by: newest.actor_name ?? "system",
          at: newest.at.toISOString(),
        };
      }
    }

    const open_issues = issue_set.issues.filter((i) => i.resolved_at === null && i.cleared_by === null);
    const checklist = CHECKLIST_STATES.has(row.state)
      ? build_checklist(standards, text_cards, open_issues, open_flags.map((f) => f.flag_id), src.ai_spans, dependencies)
      : [];

    const lesson: Lesson = {
      lesson_id,
      lesson_key: lesson_id.slice(lesson_id.lastIndexOf(".") + 1),
      unit_id: row.unit_id,
      number: row.number,
      title: row.title,
      type: row.type,
      state: row.state,
      version_number: src.version_number,
      version_id: src.version_id,
      content_hash: src.hash,
      state_vector: src.vector,
      schema_version: src.schema_version,
      last_editor: row.last_editor_name ?? null,
      snapshot: src.snapshot,
      front_matter: { ...src.content.front_matter, standards },
      sections: src.content.sections.map((s) => ({
        address: s.address,
        name: s.name,
        minutes: s.minutes,
        content: s.content as Lesson["sections"][number]["content"],
      })),
      text_cards,
      outline_row,
      alignment_map: alignment_map(current_links),
      reviewer: row.reviewer_name ?? null,
      send_back,
      checklist,
      dependencies,
      allowed_actions: ACTIONS.filter(
        (a) =>
          transition_roles(a).includes(user.role) &&
          decide_transition({
            action: a,
            role: user.role,
            from_state: row.state,
            note: "n",
            reason: "r",
            rating: "usable_as_drafted",
          }).allowed,
      ),
    };
    return { lesson, version_id: src.version_id };
  }

  async history(_user: RequestUser, lesson_id: LessonId): Promise<LessonHistory> {
    const row = await this.states.get(lesson_id);
    if (row === null) throw new DomainRefusal("NOT_FOUND", "Lesson not found.", { lesson_id });

    const rows = [...(await this.versions.list_for_lesson(lesson_id))].sort((a, b) => a.number - b.number);
    const cache = new Map<string, LessonVersionRow | null>();
    const origin = async (id: string): Promise<LessonVersionRow | null> => {
      if (!cache.has(id)) cache.set(id, await this.versions.version(id));
      return cache.get(id) ?? null;
    };

    const versions: LessonHistory["versions"] = [];
    for (const v of rows) {
      const p = v.provenance;
      let provenance: LessonHistory["versions"][number]["provenance"];
      if (v.kind === "submit" || v.kind === "approve" || v.kind === "reopen") {
        const src = p.derived_from_version_id === null ? null : await origin(p.derived_from_version_id);
        const base: ProvenanceRecord = src === null ? p : { ...p, ...pick_origin(src.provenance) };
        provenance = {
          outline_row_hash: base.outline_row_hash,
          prompt_version_id: base.prompt_version_id ?? "",
          model: null,
          parameters: null,
          schema_version: base.schema_version,
          example_set_id: null,
          run_id: base.run_id,
          cost_usd: 0,
          derived_from_version_id: p.derived_from_version_id,
        };
      } else {
        provenance = {
          outline_row_hash: p.outline_row_hash,
          prompt_version_id: p.prompt_version_id ?? "",
          model: p.model,
          parameters: (p.parameters ?? null) as Record<string, unknown> | null,
          schema_version: p.schema_version,
          example_set_id: p.example_set_id,
          run_id: p.run_id,
          cost_usd: p.cost_usd.toNumber(),
          derived_from_version_id: p.derived_from_version_id,
        };
      }
      versions.push({
        version_id: v.version_id,
        version_number: v.number,
        kind: v.kind === "approve" ? "approval" : v.kind,
        content_hash: v.content_hash,
        created_at: v.stored_at.toISOString(),
        created_by: v.created_by ?? "system",
        adopted: v.kind === "candidate" ? v.adopted : null,
        provenance,
      });
    }

    const events = [...(await this.audit.history(lesson_id))].sort((a, b) => a.at.getTime() - b.at.getTime());
    return {
      versions,
      audit: events.map((h) => ({
        at: h.at.toISOString(),
        user: h.actor_name ?? "system",
        action: h.action,
        from_state: h.from_state,
        to_state: h.to_state,
        version_hash: h.version_hash ?? NO_HASH,
        reason: h.reason,
      })),
      ai_spans: events
        .filter((h) => h.action === AI_ACCEPT_ACTION)
        .map((h) => ({ accepted_by: h.actor_name ?? "system", at: h.at.toISOString() })),
    };
  }

  // Frozen states read the snapshot, never the derived row; nothing reads the live document.
  private async source(state: LessonStateName, current_version_id: string | null, lesson_id: LessonId): Promise<Source> {
    if (FROZEN.has(state)) {
      const snap = await this.versions.latest_snapshot(lesson_id);
      if (snap === null || snap.state_vector === null) {
        throw new InvariantViolation(`Frozen lesson has no usable snapshot: ${lesson_id}`);
      }
      return {
        content: snap.lesson,
        hash: snap.content_hash,
        vector: snap.state_vector,
        schema_version: snap.lesson.schema_version,
        version_number: snap.number,
        version_id: snap.version_id,
        snapshot: { version_id: snap.version_id, content_hash: snap.content_hash, state_vector: snap.state_vector },
        ai_spans: snap.provenance.ai_assisted_spans,
      };
    }
    const d = await this.reader.latest_derived(lesson_id);
    if (d === null) throw new DomainRefusal("NOT_FOUND", "Lesson has no stored content.", { lesson_id });
    const cur = current_version_id === null ? null : await this.versions.version(current_version_id);
    return {
      content: d.lesson,
      hash: d.content_hash,
      vector: d.state_vector,
      schema_version: d.schema_version,
      version_number: cur?.number ?? 0,
      version_id: current_version_id,
      snapshot: null,
      ai_spans: cur?.provenance.ai_assisted_spans ?? 0,
    };
  }

  private check_schema(content: StoredLesson, schema_version: number, lesson_id: LessonId): void {
    try {
      assert_known_nodes({ type: "doc" }, schema_version);
      for (const s of content.sections) assert_known_nodes(s.content as unknown as PMJson, schema_version);
    } catch (e) {
      if (e instanceof SchemaUnknownError) {
        throw new DomainRefusal("SCHEMA_UNKNOWN", "The stored lesson uses a schema this version cannot open.", {
          lesson_id,
          schema_version: e.schema_version,
          unknown_nodes: [...e.unknown_nodes],
        });
      }
      throw e;
    }
  }
}

function pick_origin(p: ProvenanceRecord): Pick<ProvenanceRecord, "outline_row_hash" | "prompt_version_id" | "schema_version" | "run_id"> {
  return {
    outline_row_hash: p.outline_row_hash,
    prompt_version_id: p.prompt_version_id,
    schema_version: p.schema_version,
    run_id: p.run_id,
  };
}

function asserted_by(rows: readonly AlignmentLinkRow[]): Asserted {
  return rows.some((r) => r.asserted_by === "reviewer") ? "reviewer" : (rows[0]?.asserted_by ?? "outline");
}

function merge_standards(stored: readonly Standard[], links: readonly AlignmentLinkRow[]): Standard[] {
  return stored.map((s) => {
    const rows = links.filter((l) => l.code === s.code);
    if (rows.length === 0) return { ...s };
    const by = asserted_by(rows);
    let confirmation = s.confirmation;
    if (confirmation !== "removed") {
      if (rows.some((r) => r.confirmed_by !== null)) confirmation = "confirmed";
      else if (confirmation !== null && by !== "outline") confirmation = "open";
    }
    return { ...s, asserted_by: by, confirmation };
  });
}

function alignment_map(links: readonly AlignmentLinkRow[]): AlignmentEntry[] {
  const groups = new Map<string, AlignmentLinkRow[]>();
  for (const l of links) groups.set(l.code, [...(groups.get(l.code) ?? []), l]);
  return [...groups].map(([code, rows]) => ({
    code,
    teach_links: rows.filter((r) => r.role === "I" || r.role === "P").map((r) => r.address),
    check_links: rows.filter((r) => r.role === "A").map((r) => r.address),
    link_role: rows.some((r) => r.role === "I") ? "I" : rows.some((r) => r.role === "P") ? "P" : "A",
    asserted_by: asserted_by(rows),
  }));
}

function to_text_card(c: StoredLesson["text_cards"][number]): TextCard {
  return {
    title: c.title,
    author: c.author,
    edition_or_isbn: c.edition,
    chapter: c.chapter,
    pages: c.pages,
    kind: c.kind === "newsela-article" ? "newsela-reference" : c.kind === "public-domain" ? "excerpt" : "off-platform-text",
    rights_status:
      c.kind === "public-domain"
        ? "public-domain"
        : c.kind === "newsela-article"
          ? "Newsela-owned"
          : !c.content_available
            ? "to-clear"
            : null,
  };
}

function to_dependency(d: DependencyState): Dependency {
  const status: Dependency["status"] =
    d.source_state === "reopened"
      ? "source_reopened"
      : d.source_state === "approved" || d.source_state === "exported"
        ? "source_approved"
        : d.slot_filled
          ? "waiting_for_source_approval"
          : "slot_empty";
  return { direction: d.direction, lesson_id: d.lesson_id, slot_id: d.slot_id, status };
}

function build_checklist(
  standards: readonly Standard[],
  cards: readonly TextCard[],
  open_issues: readonly IssueRow[],
  flag_ids: readonly string[],
  ai_spans: number,
  deps: readonly Dependency[],
): ChecklistItem[] {
  const item = (key: ChecklistItem["key"], label: string, refs: string[]): ChecklistItem => ({
    key,
    label,
    status: refs.length > 0 ? "open" : "ok",
    evidence_refs: refs,
  });
  const ids = (pred: (i: IssueRow) => boolean): string[] => open_issues.filter(pred).map((i) => i.issue_id);

  const open_codes = standards.filter((s) => s.confirmation === "open").map((s) => s.code);
  const rights_refs = [
    ...ids((i) => QUOTE_KINDS.has(i.kind)),
    ...cards.flatMap((c, n) => (c.rights_status === "to-clear" ? [`text_card:${n}`] : [])),
  ];
  const eld_refs = [
    ...ids((i) => i.kind === "eld_label_mismatch"),
    ...standards.filter((s) => s.role === "eld" && s.confirmation === "open").map((s) => s.code),
  ];
  const out: ChecklistItem[] = [
    item("standards", "Standards confirmed", open_codes),
    item("quotes_and_rights", "Quotes and rights", rights_refs),
    item("eld_support", "ELD support", eld_refs),
    item("content_safety", "Content safety", [...flag_ids]),
  ];
  if (ai_spans > 0) out.push(item("ai_spans", "AI-assisted spans", ids((i) => i.kind === "disclosure_prompt")));
  if (deps.length > 0) {
    out.push(
      item(
        "dependencies",
        "Dependencies",
        deps.filter((d) => d.direction === "waits_on" && d.status !== "source_approved").map((d) => d.lesson_id),
      ),
    );
  }
  return out;
}
