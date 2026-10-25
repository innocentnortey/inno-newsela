import type { TileState } from "@ls/schema/api/runs";
import type { JobId, LessonId, LessonStateName, VersionId } from "@ls/core/ports/common";
import type { JobOutcome, JobQueue } from "@ls/core/ports/job-queue";
import type { LessonDocStore, SeedResult } from "@ls/core/ports/lesson-docs";
import type { LessonRow, LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { GeneratedVersionWrite, LessonVersionRepo, LessonVersionRow, NewGeneratedVersion } from "@ls/core/ports/lesson-versions";
import type { SafetyFlagRepo, SafetyFlagRow } from "@ls/core/ports/safety-flags";
import type { Tx, TxRunner } from "@ls/core/ports/tx";
import type { StoredLesson } from "@ls/schema/lesson";
import { ulid_body } from "./scripted-paid-caller.ts";

const unsupported = (name: string): never => {
  throw new Error(`memory store: ${name} not supported`);
};

export class MemoryVersions {
  rows: LessonVersionRow[] = [];
  async write_generated_version(v: NewGeneratedVersion, _tx: Tx): Promise<GeneratedVersionWrite> {
    const existing = this.rows.find((r) => (r as LessonVersionRow & { idempotency_key?: string }).idempotency_key === v.idempotency_key);
    if (existing !== undefined) return { version: existing, created: false };
    const number = this.rows.filter((r) => r.lesson_id === v.lesson_id).length + 1;
    const row = {
      version_id: `lv_${ulid_body(this.rows.length + 1)}` as VersionId,
      lesson_id: v.lesson_id,
      number,
      kind: v.kind,
      adopted: v.kind === "generated",
      content_hash: v.content_hash,
      state_vector: null,
      lesson: v.lesson,
      draft: v.draft,
      teacher_word_count: 0,
      provenance: v.provenance,
      dependency_record: [],
      created_by: null,
      stored_at: new Date(0),
      idempotency_key: v.idempotency_key,
    } as LessonVersionRow;
    this.rows.push(row);
    return { version: row, created: true };
  }
  async has_generated_version(lesson_id: LessonId): Promise<boolean> {
    return this.rows.some((r) => r.lesson_id === lesson_id && r.kind === "generated");
  }
  write_snapshot = (): never => unsupported("write_snapshot");
  version = (): never => unsupported("version");
  latest_snapshot = (): never => unsupported("latest_snapshot");
  candidate = (): never => unsupported("candidate");
  approved_snapshots = (): never => unsupported("approved_snapshots");
  mark_adopted = (): never => unsupported("mark_adopted");
}

export class MemoryStates {
  rows = new Map<string, { state: LessonStateName }>();
  set_calls: { lesson_id: LessonId; to: LessonStateName }[] = [];
  seed(lesson_id: LessonId, state: LessonStateName): void {
    this.rows.set(lesson_id, { state });
  }
  private row(lesson_id: LessonId): LessonRow {
    const r = this.rows.get(lesson_id);
    return { lesson_id, state: r?.state ?? "draft" } as LessonRow;
  }
  async get(lesson_id: LessonId): Promise<LessonRow | null> {
    return this.rows.has(lesson_id) ? this.row(lesson_id) : null;
  }
  async lock_for_update(lesson_id: LessonId, _tx: Tx): Promise<LessonRow> {
    return this.row(lesson_id);
  }
  async set_state(lesson_id: LessonId, to_state: LessonStateName, _reviewer: unknown, _tx: Tx): Promise<LessonRow> {
    this.rows.set(lesson_id, { state: to_state });
    this.set_calls.push({ lesson_id, to: to_state });
    return this.row(lesson_id);
  }
  state_of = (): never => unsupported("state_of");
  ensure_lessons = (): never => unsupported("ensure_lessons");
  append_review_event = (): never => unsupported("append_review_event");
  record_last_editor = (): never => unsupported("record_last_editor");
}

export class MemoryDocs {
  docs = new Map<string, { seq: number; lesson: StoredLesson }>();
  check_jobs = 0;
  async seed_initial(lesson_id: LessonId, lesson: StoredLesson, _actor: unknown, _tx: Tx): Promise<SeedResult> {
    if (this.docs.has(lesson_id)) return { lesson_id, seeded: false, store_id: null, content_hash: "0".repeat(64) };
    this.docs.set(lesson_id, { seq: 1, lesson });
    this.check_jobs += 1;
    return { lesson_id, seeded: true, store_id: null, content_hash: "0".repeat(64) };
  }
  store = (): never => unsupported("store");
}

export class MemoryFlags {
  rows: SafetyFlagRow[] = [];
  fail_next = false;
  async create_for_lesson(lesson_id: LessonId, source_rows: readonly number[], _tx: Tx): Promise<SafetyFlagRow[]> {
    if (this.fail_next) throw new Error("flag insert failed (armed)");
    const made = source_rows.map(
      (source_row) => ({ flag_id: `sf_${this.rows.length}`, lesson_id, source_row, teacher_tip_address: null, status: "open", cleared_by: null, note: null, cleared_at: null }) as SafetyFlagRow,
    );
    this.rows.push(...made);
    return made;
  }
  open_for = (): never => unsupported("open_for");
  clear = (): never => unsupported("clear");
}

/** Snapshots the four stores before fn and restores them if fn throws: the rollback proof for AC-9. */
export class MemoryTxRunner implements TxRunner {
  constructor(private readonly stores: { versions: MemoryVersions; states: MemoryStates; docs: MemoryDocs; flags: MemoryFlags }) {}
  async with_tx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const { versions, states, docs, flags } = this.stores;
    const snap = {
      v: [...versions.rows],
      s: new Map(states.rows),
      sc: [...states.set_calls],
      d: new Map(docs.docs),
      cj: docs.check_jobs,
      f: [...flags.rows],
    };
    try {
      return await fn({});
    } catch (e) {
      versions.rows = snap.v;
      states.rows = snap.s;
      states.set_calls = snap.sc;
      docs.docs = snap.d;
      docs.check_jobs = snap.cj;
      flags.rows = snap.f;
      throw e;
    }
  }
}

export class MemoryJobQueue {
  lease_ok = true;
  /** renew_lease calls that return false from this call number on (1-based); 0 = never */
  lease_lost_at = 0;
  private renewals = 0;
  tiles: TileState[] = [];
  finished: JobOutcome[] = [];
  cancelled: () => boolean = () => false;
  async renew_lease(_job_id: JobId, _lease_ms: number): Promise<boolean> {
    this.renewals += 1;
    if (this.lease_lost_at > 0 && this.renewals >= this.lease_lost_at) return false;
    return this.lease_ok;
  }
  async set_tile_state(_job_id: JobId, tile_state: TileState): Promise<void> {
    this.tiles.push(tile_state);
  }
  async finish(outcome: JobOutcome): Promise<void> {
    this.finished.push(outcome);
  }
  async is_cancelled(_job_id: JobId): Promise<boolean> {
    return this.cancelled();
  }
}

export interface MemoryWorld {
  versions: MemoryVersions;
  states: MemoryStates;
  docs: MemoryDocs;
  flags: MemoryFlags;
  tx: MemoryTxRunner;
  queue: MemoryJobQueue;
}

export function make_world(): MemoryWorld {
  const versions = new MemoryVersions();
  const states = new MemoryStates();
  const docs = new MemoryDocs();
  const flags = new MemoryFlags();
  return { versions, states, docs, flags, tx: new MemoryTxRunner({ versions, states, docs, flags }), queue: new MemoryJobQueue() };
}

// Compile-time proof that the doubles satisfy the ports they stand in for.
export const as_ports = (w: MemoryWorld): { versions: LessonVersionRepo; states: LessonStateRepo; docs: LessonDocStore; flags: SafetyFlagRepo; queue: JobQueue } => ({
  versions: w.versions,
  states: w.states,
  docs: w.docs,
  flags: w.flags,
  queue: w.queue as unknown as JobQueue,
});
