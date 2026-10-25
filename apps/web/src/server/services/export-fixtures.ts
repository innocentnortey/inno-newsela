// NL-51 frozen test fixtures (synthetic only). Do not edit: hashed in docs/plans/frozen-tests/NL-51.manifest.json.
// In-memory world for ExportService: ports over plain maps, a transaction runner that rolls back, and sentinel
// strings that must never reach an export. Unit G6.U4; WP-1 pair: L4 links to L5 (L4 waits on L5).
import Decimal from "decimal.js";
import { FakeClock } from "@ls/core/ports/clock";
import type { NewAuditEvent } from "@ls/core/ports/audit";
import type { LessonStateName, RequestUser } from "@ls/core/ports/common";
import type { ExportBundleRow, ExportRepo, NewExportBundle } from "@ls/core/ports/exports";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { DependencyState, LessonGraphRepo } from "@ls/core/ports/lesson-graph";
import type { LessonRow, LessonStateRepo, NewReviewEvent, ReviewEventRow } from "@ls/core/ports/lesson-state";
import type { LessonVersionRepo, LessonVersionRow } from "@ls/core/ports/lesson-versions";
import type { Tx, TxFunction, TxRunner } from "@ls/core/ports/tx";
import type { ExportBundleFile } from "@ls/schema/export";
import type { StoredLesson } from "@ls/schema/lesson";
import type { LessonDraft } from "@ls/schema/lesson-draft";
import { content_hash } from "@ls/schema/content-hash";
import { ExportService } from "./export-service.ts";

export const UNIT = "G6.U4";
export const crock = (p: string, c: string) => `${p}_${c.repeat(26)}`;
export const U_APPROVER = crock("usr", "1");
export const U_AUTHOR = crock("usr", "2");
export const U_REVIEWER = crock("usr", "3");

// Strings that exist only in internal data. None may appear in any export.
export const SENTINELS = {
  prompt: "SENTINEL-PROMPT-7f3",
  raw_output: "SENTINEL-RAWOUT-7f3",
  draft: "SENTINEL-DRAFT-7f3",
  model: "SENTINEL-MODEL-7f3",
  note: "SENTINEL-NOTE-7f3",
  reviewer_name: "SENTINEL-REVIEWER-7f3",
  email: "sentinel.person@example.test",
  minutes_log: "SENTINEL-MINUTES-7f3",
} as const;

export function user(role: RequestUser["role"]): RequestUser {
  const id = role === "approver" ? U_APPROVER : role === "author" ? U_AUTHOR : U_REVIEWER;
  return {
    user_id: id,
    name: role === "approver" ? SENTINELS.reviewer_name : `Test ${role}`,
    email: role === "approver" ? SENTINELS.email : `${role}@example.test`,
    role,
    synthetic: true,
    request_id: crock("req", "9"),
  };
}

export function make_lesson(lesson_id: string, text = "body"): StoredLesson {
  const doc = { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
  return {
    lesson_id,
    schema_version: 1,
    title: `Lesson ${lesson_id}`,
    type: "Reading",
    front_matter: { standards: [], minutes_total: 50, vocabulary: ["inference"] },
    sections: [{ address: `${lesson_id}.Launch`, name: "Launch", minutes: 10, content: doc }],
    text_cards: [],
  };
}

let seq = 0;
export interface SnapshotOpts {
  kind?: LessonVersionRow["kind"];
  number?: number;
  version_id?: string;
  created_by?: string | null;
  stored_at?: Date;
  text?: string;
}

// A snapshot row carrying internal data that the export must drop.
export function snapshot_row(lesson_id: string, o: SnapshotOpts = {}): LessonVersionRow {
  const lesson = make_lesson(lesson_id, o.text ?? "body");
  const n = ++seq;
  const hex = n.toString(16).padStart(26, "0").toUpperCase().replace(/[ILOU]/g, "0");
  return {
    version_id: o.version_id ?? `lv_${hex}`,
    lesson_id,
    number: o.number ?? 1,
    kind: o.kind ?? "approve",
    adopted: false,
    content_hash: content_hash(lesson),
    state_vector: "c".repeat(64),
    lesson: { ...lesson, rendered_prompt: SENTINELS.prompt, raw_output: SENTINELS.raw_output } as unknown as StoredLesson,
    draft: { note: SENTINELS.draft } as unknown as LessonDraft,
    teacher_word_count: 0,
    provenance: {
      outline_row_hash: "a".repeat(64),
      prompt_version_id: SENTINELS.prompt,
      model: SENTINELS.model,
      parameters: { rendered_prompt: SENTINELS.prompt },
      schema_version: 1,
      example_set_id: null,
      run_id: null,
      model_call_ids: [],
      cost_usd: new Decimal("0.42"),
      ai_assisted_spans: 0,
      derived_from_version_id: null,
    },
    dependency_record: [],
    created_by: o.created_by === undefined ? U_APPROVER : o.created_by,
    stored_at: o.stored_at ?? new Date(`2026-10-0${(n % 8) + 1}T10:00:00.000Z`),
  } as LessonVersionRow;
}

interface State {
  states: Map<string, { state: LessonStateName; reviewer_id: string | null }>;
  exports: ExportBundleRow[];
  payloads: Map<string, ExportBundleFile>;
  audit: NewAuditEvent[];
  review_events: NewReviewEvent[];
  state_writes: Array<{ lesson_id: string; to: LessonStateName }>;
}

const clone = <T>(v: T): T => structuredClone(v);

export class World {
  states: State["states"] = new Map();
  exports: ExportBundleRow[] = [];
  payloads: State["payloads"] = new Map();
  audit: NewAuditEvent[] = [];
  review_events: NewReviewEvent[] = [];
  state_writes: State["state_writes"] = [];
  /** Immutable history rows (any kind); only `approve` rows of approved/exported lessons may feed an export. */
  versions: LessonVersionRow[] = [];
  /** Pre-existing review notes the export must never contain. */
  stored_notes: string[] = [SENTINELS.note, SENTINELS.minutes_log];
  /** Names of port methods the service must not call (draft, derived, candidate, non-approved reads). */
  forbidden_reads: string[] = [];
  links: Array<{ from: string; to: string }> = [];
  locks: (string | null)[] = [];
  fail_next_insert = false;

  set_state(lesson_id: string, state: LessonStateName): void {
    this.states.set(lesson_id, { state, reviewer_id: null });
  }
  add_version(row: LessonVersionRow): LessonVersionRow {
    this.versions.push(row);
    return row;
  }
  /** Seed a lesson in `state`; adds an approve snapshot unless `approve: false`. Returns that snapshot or null. */
  seed(lesson_id: string, state: LessonStateName, o: { approve?: boolean; text?: string } = {}): LessonVersionRow | null {
    this.set_state(lesson_id, state);
    if (o.approve === false) return null;
    return this.add_version(snapshot_row(lesson_id, { text: o.text ?? "body" }));
  }
  /** The approved lesson changes: a new approve snapshot with new content. */
  reapprove(lesson_id: string, text: string): LessonVersionRow {
    const prev = this.versions.filter((v) => v.lesson_id === lesson_id && v.kind === "approve").length;
    return this.add_version(snapshot_row(lesson_id, { number: prev + 1, text }));
  }
  link(from: string, to: string): void {
    this.links.push({ from, to });
  }
  snapshot(): State {
    return clone({
      states: this.states,
      exports: this.exports,
      payloads: this.payloads,
      audit: this.audit,
      review_events: this.review_events,
      state_writes: this.state_writes,
    });
  }
  restore(s: State): void {
    const c = clone(s);
    this.states = c.states;
    this.exports = c.exports;
    this.payloads = c.payloads;
    this.audit = c.audit;
    this.review_events = c.review_events;
    this.state_writes = c.state_writes;
  }
  writes(): number {
    return this.exports.length + this.audit.length + this.review_events.length + this.state_writes.length;
  }

  readonly tx: TxRunner = {
    with_tx: async <T>(fn: TxFunction<T>, advisory_lock: string | null = null): Promise<T> => {
      this.locks.push(advisory_lock);
      const before = this.snapshot();
      const tx: Tx = {};
      try {
        return await fn(tx);
      } catch (e) {
        this.restore(before);
        throw e;
      }
    },
  };

  readonly version_repo: LessonVersionRepo = {
    approved_snapshots: async (unit_id) => {
      if (unit_id !== UNIT) return [];
      const out: LessonVersionRow[] = [];
      for (const [id, s] of [...this.states].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))) {
        if (s.state !== "approved" && s.state !== "exported") continue;
        const approves = this.versions.filter((v) => v.lesson_id === id && v.kind === "approve");
        const latest = approves.sort((a, b) => b.number - a.number)[0];
        if (latest) out.push(clone(latest));
      }
      return out;
    },
    write_generated_version: async () => this.forbid("write_generated_version"),
    write_snapshot: async () => this.forbid("write_snapshot"),
    version: async () => this.forbid("version"),
    latest_snapshot: async () => this.forbid("latest_snapshot"),
    candidate: async () => this.forbid("candidate"),
    has_generated_version: async () => this.forbid("has_generated_version"),
    mark_adopted: async () => this.forbid("mark_adopted"),
  };

  private forbid(name: string): never {
    this.forbidden_reads.push(name);
    throw new Error(`export service must not call ${name}`);
  }

  readonly export_repo: ExportRepo = {
    insert: async (b: NewExportBundle) => {
      if (this.fail_next_insert) {
        this.fail_next_insert = false;
        throw new Error("injected insert failure");
      }
      const mine = this.exports.filter((e) => e.unit_id === b.unit_id);
      const row: ExportBundleRow = {
        export_id: `exp_${String(this.exports.length + 1).padStart(26, "0")}`,
        unit_id: b.unit_id,
        version_number: mine.length + 1,
        payload_sha256: b.payload_sha256,
        lesson_versions: [...b.lesson_versions],
        held_back: clone(b.held_back),
        created_by: b.created_by,
        created_at: new Date("2026-10-20T10:00:00.000Z"),
      };
      this.exports.push(row);
      this.payloads.set(row.export_id, clone(b.payload));
      return clone(row);
    },
    latest: async (unit_id) => {
      const mine = this.exports.filter((e) => e.unit_id === unit_id);
      return mine.length === 0 ? null : clone(mine[mine.length - 1] as ExportBundleRow);
    },
    all_for_unit: async (unit_id) => clone(this.exports.filter((e) => e.unit_id === unit_id).reverse()),
    payload: async (export_id) => {
      const p = this.payloads.get(export_id);
      return p === undefined ? null : clone(p);
    },
  };

  readonly audit_log = {
    append: async (e: NewAuditEvent) => {
      this.audit.push(clone(e));
      return crock("ae", "7");
    },
    history: async () => this.forbid("history"),
    standard_decisions: async () => this.forbid("standard_decisions"),
  };

  readonly state_repo: LessonStateRepo = {
    lock_for_update: async (lesson_id) => this.row(lesson_id),
    set_state: async (lesson_id, to_state, reviewer_id) => {
      const s = this.states.get(lesson_id);
      if (!s) throw new Error(`unknown lesson ${lesson_id}`);
      s.state = to_state;
      s.reviewer_id = reviewer_id;
      this.state_writes.push({ lesson_id, to: to_state });
      return this.row(lesson_id);
    },
    append_review_event: async (e): Promise<ReviewEventRow> => {
      this.review_events.push(clone(e));
      return {
        review_event_id: `ev_${String(this.review_events.length).padStart(26, "0")}`,
        lesson_id: e.lesson_id,
        from_state: e.from_state,
        to_state: e.to_state,
        actor_id: e.actor_id,
        at: new Date("2026-10-20T10:00:00.000Z"),
      };
    },
    get: async () => this.forbid("get"),
    state_of: async () => this.forbid("state_of"),
    ensure_lessons: async () => this.forbid("ensure_lessons"),
    record_last_editor: async () => this.forbid("record_last_editor"),
  };

  private row(lesson_id: string): LessonRow {
    const s = this.states.get(lesson_id);
    if (!s) throw new Error(`unknown lesson ${lesson_id}`);
    return {
      lesson_id,
      unit_id: UNIT,
      number: null,
      type: "Reading",
      title: `Lesson ${lesson_id}`,
      state: s.state,
      current_version_id: null,
      reviewer_id: s.reviewer_id,
      last_editor_id: null,
      schema_version: 1,
    };
  }

  readonly graph_repo: LessonGraphRepo = {
    dependencies: async (lesson_id) => {
      const out: DependencyState[] = [];
      for (const k of this.links) {
        if (k.from !== lesson_id && k.to !== lesson_id) continue;
        const waits = k.from === lesson_id;
        const other = waits ? k.to : k.from;
        const st = this.states.get(other)?.state ?? "draft";
        out.push({
          direction: waits ? "waits_on" : "depended_on_by",
          lesson_id: other,
          slot_id: "s1",
          source_state: st,
          slot_filled: true,
          source_approved_hash: null,
        });
      }
      return out;
    },
    dependants: async () => this.forbid("dependants"),
    source_outline_version: async () => this.forbid("source_outline_version"),
  };

  readonly units = {
    list_units: async () => [{ unit_id: UNIT, grade: 6, title: "Unit 4", latest_outline_version_id: null }],
  };
}

/** WP-1 world: L4 links to L5 and L3 stands alone. All states given by the caller. */
export function make_world(): World {
  const w = new World();
  w.link("G6.U4.L4", "G6.U4.L5");
  return w;
}

export function make_service(w: World): ExportService {
  return new ExportService(
    w.version_repo,
    w.export_repo,
    w.audit_log as never,
    w.tx,
    new PrefixedIdGenerator(),
    new FakeClock(),
    w.state_repo,
    w.graph_repo,
    w.units,
  );
}

/** Every key at every depth, for forbidden-key scans. */
export function all_keys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => all_keys(x, out));
  else if (v !== null && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      all_keys(x, out);
    }
  }
  return out;
}
