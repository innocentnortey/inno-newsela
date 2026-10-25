// NL-54: unit board (CON-9) and unit metrics (CON-10), read from stored rows, aggregate only (GR-15).
// No logging in this file: rows carry reviewer names and minutes, which must never be printed together.
import Decimal from "decimal.js";
import { DomainRefusal } from "@ls/core/errors";
import type { Clock } from "@ls/core/ports/clock";
import type { LessonId, RequestUser, UnitId } from "@ls/core/ports/common";
import type { BoardReadRepo } from "@ls/core/ports/board-reads";
import type { IssueRepo, LessonIssueCounts } from "@ls/core/ports/issues";
import type { LessonGraphRepo } from "@ls/core/ports/lesson-graph";
import type { MetricsRepo } from "@ls/core/ports/metrics";
import { LessonState, SendBackTag, type BoardRow, type DependencyFlag, type UnitBoard } from "@ls/schema/api/board";
import type { UnitMetrics } from "@ls/schema/api/metrics";
import { unit_key } from "./outline-service.ts";

export interface SendBackRecord { lesson_id: LessonId; tag: string | null; note: string; by: string; at: Date }
export interface UnitBoardExtras { send_backs: SendBackRecord[] }
export interface BoardExtrasRead {
  unit_extras(unit_id: UnitId): Promise<UnitBoardExtras | null>; // null = no such unit
  unit_exists(unit_id: UnitId): Promise<boolean>;
}
export type GraphLookup = Pick<LessonGraphRepo, "dependencies">;

const CAPTION = "No baseline yet (AQ-14). Measured with us as reviewers.";
const ACTIVE = new Set<string>(["draft", "in_review", "submitted", "changes_requested", "reopened"]);
const DONE = new Set<string>(["approved", "exported"]);

const lesson_key = (lesson_id: string): string => lesson_id.slice(lesson_id.lastIndexOf(".") + 1);

type SortRow = Pick<BoardRow, "lesson_id" | "number" | "state" | "blocking_count" | "confirmation_count" | "advisory_count">;

function by_lesson(a: SortRow, b: SortRow): number {
  if (a.number !== b.number) {
    if (a.number === null) return 1;
    if (b.number === null) return -1;
    return a.number - b.number;
  }
  return a.lesson_id < b.lesson_id ? -1 : a.lesson_id > b.lesson_id ? 1 : 0;
}

function group(r: SortRow): number {
  if (r.state === "generation_failed") return 0;
  return ACTIVE.has(r.state) ? 1 : 2;
}

/** UXQ-5: failed generations first, then active lessons by blocking/advisory/confirmation desc, then approved and exported. */
export function sort_rows<T extends SortRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const g = group(a) - group(b);
    if (g !== 0) return g;
    if (group(a) === 1) {
      return (
        b.blocking_count - a.blocking_count ||
        b.advisory_count - a.advisory_count ||
        b.confirmation_count - a.confirmation_count ||
        by_lesson(a, b)
      );
    }
    return by_lesson(a, b);
  });
}

/** Median of minutes, two decimals; null when empty. */
export function median_minutes(values: readonly Decimal[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a.cmp(b));
  const mid = Math.floor(s.length / 2);
  const m = s.length % 2 === 1 ? s[mid]! : s[mid - 1]!.add(s[mid]!).div(2);
  return Number(m.toFixed(2));
}

export class BoardService {
  constructor(
    private readonly board_repo: BoardReadRepo,
    private readonly issues: IssueRepo,
    private readonly metrics_repo: MetricsRepo,
    private readonly extras: BoardExtrasRead,
    private readonly graph: GraphLookup,
    private readonly clock: Clock,
  ) {}

  async board(user: RequestUser, unit_id: UnitId, state: LessonState | null): Promise<UnitBoard> {
    void user; // every signed-in role reads
    const [rows, counts, extras] = await Promise.all([
      this.board_repo.board_rows(unit_id, null),
      this.issues.counts_by_lesson(unit_id),
      this.extras.unit_extras(unit_id),
    ]);
    if (extras === null) throw new DomainRefusal("NOT_FOUND", "Not found.");

    const rollup: Record<string, number> = {};
    for (const s of LessonState.options) rollup[s] = 0;
    for (const r of rows) rollup[r.state] = (rollup[r.state] ?? 0) + 1;

    const by_id = new Map<string, LessonIssueCounts>(counts.map((c) => [c.lesson_id, c]));
    const send_back = new Map(extras.send_backs.map((s) => [s.lesson_id as string, s]));
    const flagged = rows.filter((r) => r.dependency_flag);
    const flags = new Map<string, DependencyFlag[]>(
      await Promise.all(flagged.map(async (r): Promise<[string, DependencyFlag[]]> => [r.lesson_id, await this.flags_for(r.lesson_id)])),
    );

    const out: BoardRow[] = rows.map((r) => {
      const c = by_id.get(r.lesson_id);
      const sb = send_back.get(r.lesson_id);
      const tag = SendBackTag.safeParse(sb?.tag ?? "other");
      return {
        lesson_id: r.lesson_id,
        lesson_key: lesson_key(r.lesson_id),
        number: r.number,
        title: r.title,
        type: r.type,
        state: r.state,
        blocking_count: c?.blocking ?? 0,
        confirmation_count: c?.confirmation ?? 0,
        advisory_count: c?.advisory ?? 0,
        reviewer: r.reviewer_name,
        last_change_at: r.last_change_at.toISOString(),
        dependency_flags: flags.get(r.lesson_id) ?? [],
        send_back: sb ? { tag: tag.success ? tag.data : "other", note: sb.note, by: sb.by, at: sb.at.toISOString() } : null,
        judge_flag: null,
      };
    });
    const shown = state === null ? out : out.filter((r) => r.state === state);
    return {
      unit_id,
      unit_key: unit_key(unit_id),
      generated_at: this.clock.now().toISOString(),
      rollup,
      rows: sort_rows(shown),
    };
  }

  private async flags_for(lesson_id: LessonId): Promise<DependencyFlag[]> {
    const out: DependencyFlag[] = [];
    for (const d of await this.graph.dependencies(lesson_id)) {
      if (d.direction !== "waits_on") continue;
      const key = lesson_key(d.lesson_id);
      if (!d.slot_filled) {
        out.push({ kind: "waits_on", status: "slot_empty", lesson_id: d.lesson_id, label: `Waits on ${key}` });
      } else if (!DONE.has(d.source_state)) {
        out.push({ kind: "waits_on", status: "waiting_for_source_approval", lesson_id: d.lesson_id, label: `Waits on ${key}` });
      }
      if (d.source_state === "reopened") {
        out.push({ kind: "source_reopened", status: null, lesson_id: d.lesson_id, label: `${key} was reopened` });
      }
    }
    return out;
  }

  async metrics(user: RequestUser, unit_id: UnitId): Promise<UnitMetrics> {
    void user;
    const [exists, frozen, rows] = await Promise.all([
      this.extras.unit_exists(unit_id),
      this.metrics_repo.unit_metrics_rows(unit_id),
      this.board_repo.board_rows(unit_id, null),
    ]);
    if (!exists) throw new DomainRefusal("NOT_FOUND", "Not found.");

    const human = frozen.filter((r) => r.human_sessions > 0);
    const n = human.length;
    // Reviewer names are only counted here, never emitted.
    const human_ids = new Set<string>(human.map((r) => r.lesson_id));
    const names = new Set<string>();
    for (const r of rows) if (human_ids.has(r.lesson_id) && r.reviewer_name !== null) names.add(r.reviewer_name);
    const d = names.size;
    const segment_label = n === 0 || d >= 3 ? null : `${d <= 1 ? "one reviewer" : `${d} reviewers`}, n = ${n}`;

    return {
      north_star: {
        median_minutes: median_minutes(human.map((r) => r.active_minutes)),
        n,
        fast_approvals: { count: human.filter((r) => r.active_minutes.lt(r.g2_threshold_minutes)).length, of: n },
        approved: { k: frozen.length, total: rows.length },
        caption: CAPTION,
        segment_label,
      },
      quality: null,
    };
  }
}
