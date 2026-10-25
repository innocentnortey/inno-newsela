// NL-54 frozen test helper (synthetic only). Do not edit: hashed in docs/plans/frozen-tests/NL-54.manifest.json.
import Decimal from "decimal.js";
import type { BoardReadRepo, BoardRowRecord } from "@ls/core/ports/board-reads";
import { FakeClock } from "@ls/core/ports/clock";
import type { LessonId, LessonStateName, RequestUser, UnitId } from "@ls/core/ports/common";
import type { IssueRepo, LessonIssueCounts } from "@ls/core/ports/issues";
import type { DependencyState } from "@ls/core/ports/lesson-graph";
import type { LessonMetricsRecord } from "@ls/core/ports/metrics";
import { InMemoryMetricsRepo } from "./metrics-test-fakes.ts";
import { BoardService, type BoardExtrasRead, type GraphLookup, type UnitBoardExtras } from "./board-service.ts";

export const UNIT = "G6.U4" as UnitId;
export const ZED = "Zed Quillfeather"; // synthetic reviewer display name (GR-15 scan target)
export const lid = (n: number) => `G6.U4.L${n}` as LessonId;

export function user(role: RequestUser["role"], request_id = "req_test_1"): RequestUser {
  return {
    user_id: `usr_synthetic_${role}`,
    name: `Test ${role}`,
    email: `${role}@example.test`,
    role,
    synthetic: true,
    request_id,
  } as unknown as RequestUser;
}

export function board_row(n: number, state: LessonStateName, over: Partial<BoardRowRecord> = {}): BoardRowRecord {
  return {
    lesson_id: lid(n),
    number: n,
    type: "core",
    title: `Synthetic lesson ${n}`,
    state,
    reviewer_name: null,
    last_change_at: new Date("2026-10-20T12:00:00.000Z"),
    dependency_flag: false,
    ...over,
  };
}

export class InMemoryBoardRead implements BoardReadRepo {
  calls: Array<{ unit_id: string; state: string | null }> = [];
  constructor(public rows: BoardRowRecord[] = []) {}
  async board_rows(unit_id: UnitId, state: LessonStateName | null): Promise<BoardRowRecord[]> {
    this.calls.push({ unit_id, state });
    return this.rows.filter((r) => state === null || r.state === state).map((r) => ({ ...r }));
  }
}

export class InMemoryIssueCounts {
  calls = 0;
  constructor(public counts: LessonIssueCounts[] = []) {}
  async counts_by_lesson(_unit_id: UnitId): Promise<LessonIssueCounts[]> {
    void _unit_id;
    this.calls += 1;
    return this.counts.map((c) => ({ ...c }));
  }
}

export class InMemoryExtras implements BoardExtrasRead {
  calls = 0;
  constructor(public units: Set<string> = new Set([UNIT]), public extras: UnitBoardExtras = { send_backs: [] }) {}
  async unit_extras(unit_id: UnitId): Promise<UnitBoardExtras | null> {
    this.calls += 1;
    return this.units.has(unit_id) ? { send_backs: [...this.extras.send_backs] } : null;
  }
  async unit_exists(unit_id: UnitId): Promise<boolean> {
    this.calls += 1;
    return this.units.has(unit_id);
  }
}

export class FakeGraph implements GraphLookup {
  calls: string[] = [];
  constructor(public deps: Map<string, DependencyState[]> = new Map()) {}
  async dependencies(lesson_id: LessonId): Promise<DependencyState[]> {
    this.calls.push(lesson_id);
    return [...(this.deps.get(lesson_id) ?? [])];
  }
}

// The NL-48 fake returns [] from unit_metrics_rows; this one serves what was written (first write wins, as ON CONFLICT DO NOTHING).
export class FrozenMetricsRepo extends InMemoryMetricsRepo {
  override async unit_metrics_rows(_unit_id: UnitId): Promise<LessonMetricsRecord[]> {
    void _unit_id;
    return this.rows.map((r) => ({ ...r }));
  }
}

export function frozen_row(n: number, minutes: number, threshold: number, human_sessions = 1): LessonMetricsRecord {
  return {
    lesson_id: lid(n),
    version_id: `ver_synthetic_${n}`,
    active_minutes: new Decimal(minutes),
    human_sessions,
    teacher_word_count: 400,
    g2_threshold_minutes: new Decimal(threshold),
    draft_rating: "usable_with_edits",
    approved_at: new Date("2026-10-21T12:00:00.000Z"),
  } as unknown as LessonMetricsRecord;
}

export function make_board_world(rows: BoardRowRecord[] = []) {
  const read = new InMemoryBoardRead(rows);
  const issues = new InMemoryIssueCounts();
  const extras = new InMemoryExtras();
  const graph = new FakeGraph();
  const metrics = new FrozenMetricsRepo();
  const clock = new FakeClock(new Date("2026-10-25T09:00:00.000Z"));
  const service = new BoardService(read, issues as unknown as IssueRepo, metrics, extras, graph, clock);
  return { read, issues, extras, graph, metrics, clock, service };
}
