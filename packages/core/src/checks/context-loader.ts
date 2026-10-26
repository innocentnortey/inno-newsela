import type { StoredLesson } from "@ls/schema/lesson";
import type { LessonId, OutlineVersionId, Sha256, UnitId } from "../ports/common.ts";
import type { OutlineRepo } from "../ports/outlines.ts";
import type { StandardRepo } from "../ports/standards.ts";
import type { LessonGraphRepo } from "../ports/lesson-graph.ts";
import type { LessonDocReader } from "../ports/lesson-docs.ts";
import type { SuggestionRepo } from "../ports/suggestions.ts";
import type { SafetyFlagRepo } from "../ports/safety-flags.ts";
import type { AlignmentRepo } from "../ports/alignment.ts";
import type { Clock } from "../ports/clock.ts";
import type { CheckContext, DerivedRow } from "./types.ts";
import { InvariantViolation } from "../errors.ts";

// Builds the one CheckContext the check worker, the Submit freeze and Approve all read.
// Holds ports only: no state, no cache. The lesson under check is the argument, never re-read.
export class CheckContextLoader {
  constructor(
    private readonly outlines: OutlineRepo,
    private readonly standards: StandardRepo,
    private readonly graph: LessonGraphRepo,
    private readonly reader: LessonDocReader,
    private readonly suggestions: SuggestionRepo,
    private readonly flags: SafetyFlagRepo,
    private readonly alignment: AlignmentRepo,
    private readonly clock: Clock,
  ) {}

  async load(
    lesson_id: LessonId,
    lesson: StoredLesson,
    content_hash: Sha256,
  ): Promise<CheckContext> {
    const unit_id = lesson_id.slice(0, lesson_id.lastIndexOf(".")) as UnitId;

    // The row a generated lesson is compared with never moves on re-upload (G-24, R-14).
    let version: OutlineVersionId | null | undefined =
      await this.graph.source_outline_version(lesson_id);
    if (version === null) {
      const units = await this.outlines.list_units();
      version = units.find((u) => u.unit_id === unit_id)?.latest_outline_version_id;
    }
    if (version === null || version === undefined) {
      throw new InvariantViolation(`no_outline_version: ${lesson_id}`, { lesson_id });
    }

    const recs = [...(await this.outlines.rows(version))].sort(
      (a, b) => a.row.row_number - b.row.row_number,
    );
    const own = recs.find(
      (r) =>
        r.row.lesson_id === lesson_id &&
        (r.row.kind === "lesson" || r.row.kind === "flex_day"),
    );
    if (!own) {
      throw new InvariantViolation(`lesson_has_outline_row: ${lesson_id}`, { lesson_id });
    }

    const rc = await this.outlines.row_context(version, lesson_id, null);
    const row = rc.row;

    const idx = await this.standards.index();
    const allowed_codes = [
      ...new Set(
        [...row.focus_codes, ...row.eld_codes, ...row.msls_codes].flatMap((c) =>
          idx.leaves_of(c),
        ),
      ),
    ];
    const standards = await this.standards.texts([
      ...new Set([...allowed_codes, ...lesson.front_matter.standards.map((s) => s.code)]),
    ]);

    const deps = await this.graph.dependencies(lesson_id);
    const linked_states = Object.fromEntries(
      deps.filter((d) => d.direction === "waits_on").map((d) => [d.lesson_id, d.source_state]),
    );
    const linked_ids = [
      ...new Set([
        ...deps.map((d) => d.lesson_id),
        ...(await this.graph.dependants(lesson_id)),
      ]),
    ].filter((id) => id !== lesson_id);
    const linked_lessons: DerivedRow[] = [];
    for (const id of linked_ids) {
      const d = await this.reader.latest_derived(id);
      if (d) linked_lessons.push(d);
    }

    const pending_suggestions = await this.suggestions.pending_for(
      lesson_id,
      this.clock.now(),
    );
    const safety_flags = await this.flags.open_for(lesson_id);
    const confirmations = (await this.alignment.for_lesson(lesson_id)).filter(
      (a) => a.origin === "narrowed" || a.origin === "added",
    );

    const lessons = recs.filter(
      (r) => r.row.lesson_id !== null && (r.row.kind === "lesson" || r.row.kind === "flex_day"),
    );
    const at = lessons.indexOf(own);
    const prev = at > 0 ? lessons[at - 1] : undefined;
    const previous_lesson_flags =
      prev && prev.row.lesson_id !== null ? await this.flags.open_for(prev.row.lesson_id) : [];
    const unit_coverage = await this.alignment.coverage_rows(unit_id);

    return {
      lesson_id,
      content_hash,
      outline_version_id: version,
      lesson,
      row,
      arc_header: rc.arc_header,
      allowed_codes,
      standards,
      // Model-proposed and untrusted: grounding rules must not read them.
      text_cards: lesson.text_cards,
      links: rc.links,
      linked_lessons,
      linked_states,
      pending_suggestions,
      safety_flags,
      confirmations,
      previous_lesson_flags,
      unit_coverage,
    };
  }
}
