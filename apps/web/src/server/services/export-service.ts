// NL-51: ExportService (CON-23). A versioned JSON export of a unit's approved snapshots; a dependent lesson is
// included only while every lesson it links to is included or exported; the same payload twice writes nothing.
import { createHash } from "node:crypto";
import { DomainRefusal, InvariantViolation } from "@ls/core/errors";
import type { AuditLog } from "@ls/core/ports/audit";
import type { Clock } from "@ls/core/ports/clock";
import type { LessonId, RequestUser, UnitId } from "@ls/core/ports/common";
import type { ExportBundleRow, ExportRepo, HeldBackRecord } from "@ls/core/ports/exports";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { LessonGraphRepo } from "@ls/core/ports/lesson-graph";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { LessonVersionRepo, LessonVersionRow } from "@ls/core/ports/lesson-versions";
import type { OutlineRepo } from "@ls/core/ports/outlines";
import type { TxRunner } from "@ls/core/ports/tx";
import type { ExportCreated, ExportList } from "@ls/schema/api/exports";
import { canonical_json } from "@ls/schema/content-hash";
import { ExportBundleFile } from "@ls/schema/export";
import { StoredLesson } from "@ls/schema/lesson";

export const HELD_BACK_REASON = "a lesson it links to is not approved";
const EPOCH = "1970-01-01T00:00:00.000Z";

export function unit_key(unit_id: string): string {
  return unit_id.toLowerCase().replace(".", "-");
}

export function payload_hash(p: ExportBundleFile): string {
  return createHash("sha256").update(canonical_json(p), "utf8").digest("hex");
}

// Field by field: nothing internal (draft, provenance, state vector, dependency record) can be copied by accident.
export function build_payload(unit_id: UnitId, rows: readonly LessonVersionRow[]): ExportBundleFile {
  let latest_ms = 0;
  const lessons = rows.map((r) => {
    if (r.created_by === null) throw new InvariantViolation("approve snapshot has no approver", { version_id: r.version_id });
    latest_ms = Math.max(latest_ms, r.stored_at.getTime());
    return {
      lesson_id: r.lesson_id,
      version_id: r.version_id,
      content_hash: r.content_hash,
      approved_by: r.created_by,
      approved_at: r.stored_at.toISOString(),
      lesson: StoredLesson.parse(r.lesson),
    };
  });
  return ExportBundleFile.parse({
    export_version: 1,
    unit_id,
    generated_at: lessons.length === 0 ? EPOCH : new Date(latest_ms).toISOString(),
    lessons,
  });
}

interface Plan {
  included: LessonVersionRow[];
  held_back: HeldBackRecord[];
}

const same_versions = (a: Plan, b: Plan): boolean =>
  a.included.length === b.included.length && a.included.every((r, i) => r.version_id === b.included[i]!.version_id);

export class ExportService {
  constructor(
    private readonly versions: LessonVersionRepo,
    private readonly exports: ExportRepo,
    private readonly audit: AuditLog,
    private readonly tx: TxRunner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly states: LessonStateRepo,
    private readonly graph: LessonGraphRepo,
    private readonly units: Pick<OutlineRepo, "list_units">,
  ) {
    void this.ids;
    void this.clock;
  }

  private require_approver(user: RequestUser): void {
    if (user.role !== "approver") throw new DomainRefusal("ROLE_FORBIDDEN", "Your role cannot do this.");
  }

  private async resolve_unit(ref: string): Promise<UnitId> {
    const units = await this.units.list_units();
    const hit = units.find((u) => u.unit_id === ref || unit_key(u.unit_id) === ref);
    if (!hit) throw new DomainRefusal("NOT_FOUND", "unit not found", { unit: ref });
    return hit.unit_id;
  }

  // Reads only. A lesson is held back if a lesson it waits on is not approved/exported, or is itself held back.
  private async plan_export(unit_id: UnitId): Promise<Plan> {
    const rows = await this.versions.approved_snapshots(unit_id);
    const deps = new Map<LessonId, Awaited<ReturnType<LessonGraphRepo["dependencies"]>>>();
    for (const r of rows) {
      deps.set(r.lesson_id, (await this.graph.dependencies(r.lesson_id)).filter((d) => d.direction === "waits_on"));
    }
    const held = new Map<LessonId, HeldBackRecord>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const r of rows) {
        if (held.has(r.lesson_id)) continue;
        for (const d of deps.get(r.lesson_id) ?? []) {
          const ok = (d.source_state === "approved" || d.source_state === "exported") && !held.has(d.lesson_id);
          if (!ok) {
            held.set(r.lesson_id, { lesson_id: r.lesson_id, reason: HELD_BACK_REASON, waits_on: d.lesson_id });
            changed = true;
            break;
          }
        }
      }
    }
    return {
      included: rows.filter((r) => !held.has(r.lesson_id)),
      held_back: rows.filter((r) => held.has(r.lesson_id)).map((r) => held.get(r.lesson_id)!),
    };
  }

  async list(user: RequestUser, unit_ref: string): Promise<ExportList> {
    this.require_approver(user);
    const unit_id = await this.resolve_unit(unit_ref);
    const plan = await this.plan_export(unit_id);
    const all = await this.exports.all_for_unit(unit_id);
    return {
      included: plan.included.map((r) => ({ lesson_id: r.lesson_id, approved_hash: r.content_hash })),
      held_back: plan.held_back,
      exports: all.map((e) => ({
        export_id: e.export_id,
        version_number: e.version_number,
        created_at: e.created_at.toISOString(),
        created_by: e.created_by,
        lesson_count: e.lesson_versions.length,
        payload_hash: e.payload_sha256,
      })),
    } as ExportList;
  }

  private view(row: ExportBundleRow, plan: Plan, same_as_previous: boolean): ExportCreated {
    return {
      export_id: row.export_id,
      version_number: row.version_number,
      same_as_previous,
      included: plan.included.map((r) => ({ lesson_id: r.lesson_id, approved_hash: r.content_hash })),
      held_back: plan.held_back,
      download_path: "/api/exports/" + row.export_id + "/download",
    } as ExportCreated;
  }

  async create(user: RequestUser, unit_ref: string): Promise<ExportCreated> {
    this.require_approver(user);
    const unit_id = await this.resolve_unit(unit_ref);
    return this.tx.with_tx(async (tx) => {
      // Lock the included lessons, re-read, and repeat until the set is stable: a lesson reopened in between
      // can never be exported.
      let plan: Plan | null = null;
      let locked_states = new Map<LessonId, { state: string; reviewer_id: string | null }>();
      for (let attempt = 0; attempt < 3 && plan === null; attempt++) {
        const first = await this.plan_export(unit_id);
        const ids = first.included.map((r) => r.lesson_id).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
        locked_states = new Map();
        for (const id of ids) {
          const row = await this.states.lock_for_update(id, tx);
          locked_states.set(id, { state: row.state, reviewer_id: row.reviewer_id });
        }
        const again = await this.plan_export(unit_id);
        const stable = same_versions(first, again) && [...locked_states.values()].every((s) => s.state === "approved" || s.state === "exported");
        if (stable) plan = again;
      }
      if (plan === null) throw new InvariantViolation("lesson set changed during export");

      const payload = build_payload(unit_id, plan.included);
      const hash = payload_hash(payload);
      const latest = await this.exports.latest(unit_id);
      if (latest !== null && latest.payload_sha256 === hash) return this.view(latest, plan, true);

      const row = await this.exports.insert(
        {
          unit_id,
          payload_sha256: hash,
          lesson_versions: plan.included.map((r) => r.version_id),
          held_back: plan.held_back,
          payload,
          created_by: user.user_id,
        },
        tx,
      );
      let newly = 0;
      const ordered = [...plan.included].sort((a, b) => a.lesson_id.localeCompare(b.lesson_id, "en", { numeric: true }));
      for (const snap of ordered) {
        const locked = locked_states.get(snap.lesson_id)!;
        if (locked.state !== "approved") continue;
        await this.states.set_state(snap.lesson_id, "exported", locked.reviewer_id, tx);
        await this.states.append_review_event(
          {
            lesson_id: snap.lesson_id,
            version_id: snap.version_id,
            from_state: "approved",
            to_state: "exported",
            actor_id: user.user_id,
            reason: null,
            reason_tag: null,
            note: null,
            content_hash: snap.content_hash,
            request_id: user.request_id,
          },
          tx,
        );
        newly++;
      }
      await this.audit.append(
        {
          actor_id: user.user_id,
          action: "export.create",
          target_kind: "export",
          target_id: row.export_id,
          version_hash: hash,
          reason: null,
          details: { unit_id, version_number: row.version_number, lesson_count: plan.included.length, newly_exported: newly },
          request_id: user.request_id,
          store_id: null,
        },
        tx,
      );
      return this.view(row, plan, false);
    }, "export:" + unit_id);
  }

  async download(user: RequestUser, export_id: string): Promise<ExportBundleFile> {
    this.require_approver(user);
    const p = await this.exports.payload(export_id);
    if (p === null) throw new DomainRefusal("NOT_FOUND", "export not found", { export_id });
    return p;
  }
}
