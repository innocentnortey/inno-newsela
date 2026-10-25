import { createHash } from "node:crypto";
import { InvariantViolation } from "@ls/core/errors";
import type { LessonId, OutlineVersionId } from "@ls/core/ports/common";
import type {
  GateInputs,
  NewOutlineVersion,
  OutlineRepo,
  OutlineRowRecord,
  RowContext,
  UnitRow,
} from "@ls/core/ports/outlines";
import type { StandardRepo } from "@ls/core/ports/standards";
import type { Tx } from "@ls/core/ports/tx";
import { compute_lesson_links } from "@ls/core/intake/lesson-links";
import type { EldVerdictTable, StandardRow } from "@ls/core/intake/standards-index";
import { canonical_json } from "@ls/schema/content-hash";
import { UNIT_ID_RE } from "@ls/schema/ids";
import {
  NormalizedRow,
  type IntakeChoiceRow,
  type IntakeFinding,
  type LessonLinkRecord,
  type NormalizedOutline,
  type OutlineVersionRow,
  type UnitRuleRecord,
} from "@ls/schema/outline";
import type { RunState } from "@ls/schema/api/runs";
import type { PgDatabase } from "../pool.ts";
import { Tx as DbTx } from "../tx.ts";
import type { PgRepoDeps } from "./audit.ts";
import type { Clock } from "@ls/core/ports/clock";

export class NotBuiltYet extends Error {
  constructor(readonly owner: string) {
    super("NOT BUILT: " + owner);
    this.name = "NotBuiltYet";
  }
}

export interface UnitOverviewVersion {
  version: OutlineVersionRow;
  created_by: string;
  row_counts: { lessons: number; flex_days: number; arc_headers: number; total_rows: number };
  lesson_hashes: Record<string, string>;
}
export interface UnitOverviewData {
  unit: UnitRow;
  versions: UnitOverviewVersion[];
  latest_run: { run_id: string; state: RunState } | null;
}

const sha256hex = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Hash of a row's content; `row_number` is excluded so a row that only moved is not "changed". */
export function row_hash_of(row: NormalizedRow): string {
  const copy: Record<string, unknown> = { ...row };
  delete copy["row_number"];
  return sha256hex(canonical_json(copy));
}

interface StoredRow {
  row_number: number;
  kind: string;
  lesson_id: string | null;
  segments_json: unknown;
  codes_json: Record<string, unknown>;
  row_hash: string;
}

interface StoredVersion {
  id: string;
  unit_id: string;
  number: number;
  sha256: string;
  same_as_version: number | null;
  source_kind: string;
  uploaded_by: string;
  created_at: Date;
  confirmed_at: Date | null;
}

function version_row(r: StoredVersion): OutlineVersionRow {
  return {
    outline_version_id: r.id,
    unit_id: r.unit_id,
    number: r.number,
    sha256: r.sha256,
    same_as_version: r.same_as_version,
    source_kind: r.source_kind,
    uploaded_by: r.uploaded_by,
    created_at: r.created_at.toISOString(),
    confirmed_at: r.confirmed_at === null ? null : r.confirmed_at.toISOString(),
  } as OutlineVersionRow;
}

function rebuild_row(outline_version_id: string, r: StoredRow): NormalizedRow {
  const c = r.codes_json;
  const meta = (c["meta"] ?? {}) as Record<string, unknown>;
  const parsed = NormalizedRow.safeParse({
    row_number: r.row_number,
    kind: r.kind,
    lesson_id: r.lesson_id,
    number: meta["number"] ?? null,
    title: meta["title"] ?? "",
    lesson_type: meta["lesson_type"] ?? "",
    arc: meta["arc"] ?? null,
    segments: r.segments_json,
    focus_codes: c["focus_codes"],
    eld_codes: c["eld_codes"],
    msls_codes: c["msls_codes"],
    vocabulary: c["vocabulary"],
    homework: meta["homework"] ?? null,
    pages: meta["pages"] ?? null,
    text_set: meta["text_set"] ?? null,
  });
  if (!parsed.success) throw new InvariantViolation("stored outline row invalid", { outline_version_id, row_number: r.row_number });
  return parsed.data;
}

interface MetaRow {
  codes: { unit_as_written: string; unit_from_filenames: string | null; unit_rules: UnitRuleRecord[]; counts: NormalizedOutline["counts"] };
  findings: IntakeFinding[];
}

const link_key = (k: string, from: string, to: string, slot: string): string => [k, from, to, slot].join("\u0000");

let verdict_cache: EldVerdictTable | null = null;

export class PgOutlineRepo implements OutlineRepo {
  private readonly db: PgDatabase;
  private readonly clock: Clock;

  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
    this.clock = deps.clock;
  }

  private read<T>(fn: (tx: DbTx) => Promise<T>): Promise<T> {
    return this.db.with_tx(fn);
  }

  async list_units(): Promise<UnitRow[]> {
    const rows = await this.read(async (tx) => (await tx.query<{ id: string; grade: number; title: string; n: number | null }>(UNITS_SQL)).rows);
    return rows.map((u) => ({
      unit_id: u.id,
      grade: u.grade,
      title: u.title,
      latest_outline_version_id: u.n === null ? null : `${u.id}.ov${u.n}`,
    }));
  }

  async insert_version(v: NewOutlineVersion, outline: NormalizedOutline, links: readonly LessonLinkRecord[], tx: Tx): Promise<OutlineVersionRow> {
    if (!(tx instanceof DbTx)) throw new InvariantViolation("outline write needs a real transaction");
    // Serializes near-simultaneous uploads for one unit so version numbers never repeat.
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('outline:' || $1::text))", [v.unit_id]);
    if (!UNIT_ID_RE.test(v.unit_id)) throw new InvariantViolation("bad unit id");
    const grade = Number(/^G(\d+)\./.exec(v.unit_id)?.[1]);
    const unit_no = Number(/\.U(\d+)$/.exec(v.unit_id)?.[1]);
    await tx.query("INSERT INTO unit (id, grade, title) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING", [
      v.unit_id,
      grade,
      `Grade ${grade} · Unit ${unit_no}`,
    ]);
    const number = Number(
      (await tx.query<{ n: number }>("SELECT coalesce(max(number),0)+1 AS n FROM outline_version WHERE unit_id=$1", [v.unit_id])).rows[0]?.n,
    );
    const same = (
      await tx.query<{ n: number | null }>("SELECT min(number) AS n FROM outline_version WHERE unit_id=$1 AND sha256=$2", [v.unit_id, v.sha256])
    ).rows[0]?.n ?? null;
    const id = `${v.unit_id}.ov${number}`;
    const created_at = this.clock.now();
    await tx.query(
      `INSERT INTO outline_version (id, unit_id, number, sha256, same_as_version, source_kind, source_name, uploaded_by, created_at, confirmed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,NULL)`,
      [id, v.unit_id, number, v.sha256, same, v.source_kind, v.source_name, v.uploaded_by, created_at.toISOString()],
    );

    const stored = new Set(outline.rows.map((r) => r.row_number));
    const meta_codes = {
      unit_as_written: outline.unit_as_written,
      unit_from_filenames: outline.unit_from_filenames,
      unit_rules: outline.unit_rules,
      counts: outline.counts,
    };
    const insert_row = (row_number: number, kind: string, lesson_id: string | null, segments: unknown, codes: unknown, findings: unknown, hash: string) =>
      tx.query(
        `INSERT INTO outline_row (outline_version_id, row_number, kind, lesson_id, segments_json, codes_json, findings_json, row_hash)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8)`,
        [id, row_number, kind, lesson_id, JSON.stringify(segments), JSON.stringify(codes), JSON.stringify(findings), hash],
      );
    await insert_row(
      0,
      "meta",
      null,
      [],
      meta_codes,
      outline.findings.filter((f) => f.row_number === null || !stored.has(f.row_number)),
      sha256hex(canonical_json(meta_codes)),
    );
    for (const r of outline.rows) {
      await insert_row(
        r.row_number,
        r.kind,
        r.lesson_id,
        r.segments,
        {
          focus_codes: r.focus_codes,
          eld_codes: r.eld_codes,
          msls_codes: r.msls_codes,
          vocabulary: r.vocabulary,
          meta: { number: r.number, title: r.title, lesson_type: r.lesson_type, arc: r.arc, homework: r.homework, pages: r.pages, text_set: r.text_set },
        },
        outline.findings.filter((f) => f.row_number === r.row_number),
        row_hash_of(r),
      );
    }
    for (const l of links) {
      await tx.query(
        "INSERT INTO lesson_link (outline_version_id, from_lesson_id, to_lesson_id, kind, slot_id) VALUES ($1,$2,$3,$4,$5)",
        [id, l.from_lesson_id, l.to_lesson_id, l.kind, l.to_slot_id],
      );
    }
    return {
      outline_version_id: id,
      unit_id: v.unit_id,
      number,
      sha256: v.sha256,
      same_as_version: same,
      source_kind: v.source_kind,
      uploaded_by: v.uploaded_by,
      created_at: created_at.toISOString(),
      confirmed_at: null,
    } as OutlineVersionRow;
  }

  async version(outline_version_id: OutlineVersionId): Promise<OutlineVersionRow | null> {
    const r = await this.read(async (tx) =>
      (
        await tx.query<StoredVersion>(
          "SELECT id, unit_id, number, sha256, same_as_version, source_kind, uploaded_by, created_at, confirmed_at FROM outline_version WHERE id=$1",
          [outline_version_id],
        )
      ).rows[0],
    );
    return r === undefined ? null : version_row(r);
  }

  async rows(outline_version_id: OutlineVersionId): Promise<OutlineRowRecord[]> {
    const rows = await this.read(
      async (tx) =>
        (
          await tx.query<StoredRow>(
            `SELECT row_number, kind, lesson_id, segments_json, codes_json, row_hash FROM outline_row
             WHERE outline_version_id=$1 AND kind <> 'meta' ORDER BY row_number`,
            [outline_version_id],
          )
        ).rows,
    );
    return rows.map((r) => ({ outline_version_id, row: rebuild_row(outline_version_id, r), row_hash: r.row_hash }));
  }

  private async meta(outline_version_id: string): Promise<MetaRow> {
    const r = await this.read(
      async (tx) =>
        (
          await tx.query<{ codes_json: MetaRow["codes"]; findings_json: IntakeFinding[] }>(
            "SELECT codes_json, findings_json FROM outline_row WHERE outline_version_id=$1 AND row_number=0 AND kind='meta'",
            [outline_version_id],
          )
        ).rows[0],
    );
    if (r === undefined) throw new InvariantViolation("outline version has no meta row", { outline_version_id });
    return { codes: r.codes_json, findings: r.findings_json };
  }

  /** Not on the port: the full normalizer output as stored (NL-77 uses it for the report and the gate inputs). */
  async outline(outline_version_id: OutlineVersionId): Promise<NormalizedOutline> {
    const meta = await this.meta(outline_version_id);
    const stored = await this.read(
      async (tx) =>
        (
          await tx.query<StoredRow & { findings_json: IntakeFinding[] }>(
            `SELECT row_number, kind, lesson_id, segments_json, codes_json, findings_json, row_hash FROM outline_row
             WHERE outline_version_id=$1 AND kind <> 'meta' ORDER BY row_number`,
            [outline_version_id],
          )
        ).rows,
    );
    const findings = [...meta.findings, ...stored.flatMap((r) => r.findings_json)];
    findings.sort((a, b) => (a.finding_id < b.finding_id ? -1 : a.finding_id > b.finding_id ? 1 : 0));
    return {
      unit_as_written: meta.codes.unit_as_written,
      unit_from_filenames: meta.codes.unit_from_filenames,
      rows: stored.map((r) => rebuild_row(outline_version_id, r)),
      findings,
      unit_rules: meta.codes.unit_rules,
      counts: meta.codes.counts,
    };
  }

  async choices(outline_version_id: OutlineVersionId): Promise<IntakeChoiceRow[]> {
    const rows = await this.read(
      async (tx) =>
        (
          await tx.query<{ finding_id: string; choice: string; status: string; confirmed_by: string | null; at: Date }>(
            `SELECT c.finding_id, c.choice, c.status, c.confirmed_by, coalesce(v.confirmed_at, v.created_at) AS at
             FROM intake_choice c JOIN outline_version v ON v.id = c.outline_version_id
             WHERE c.outline_version_id=$1 ORDER BY c.finding_id`,
            [outline_version_id],
          )
        ).rows,
    );
    return rows.map((r) => ({
      outline_version_id,
      finding_id: r.finding_id,
      choice: r.choice,
      status: r.status as "default" | "confirmed",
      confirmed_by: r.confirmed_by,
      at: r.at.toISOString(),
    })) as IntakeChoiceRow[];
  }

  async links(outline_version_id: OutlineVersionId): Promise<LessonLinkRecord[]> {
    const stored = await this.read(
      async (tx) =>
        (
          await tx.query<{ from_lesson_id: string; to_lesson_id: string; kind: string; slot_id: string }>(
            "SELECT from_lesson_id, to_lesson_id, kind, slot_id FROM lesson_link WHERE outline_version_id=$1 ORDER BY id",
            [outline_version_id],
          )
        ).rows,
    );
    if (stored.length === 0) return [];
    const computed = new Map(
      compute_lesson_links((await this.rows(outline_version_id)).map((r) => r.row)).map((l) => [
        link_key(l.kind, l.from_lesson_id, l.to_lesson_id, l.to_slot_id),
        l,
      ]),
    );
    return stored.map((s) => {
      const l = computed.get(link_key(s.kind, s.from_lesson_id, s.to_lesson_id, s.slot_id));
      if (l === undefined) throw new InvariantViolation("stored lesson link has no computed match", { outline_version_id });
      return l;
    });
  }

  async row_context(outline_version_id: OutlineVersionId, lesson_id: LessonId, choices: readonly IntakeChoiceRow[] | null): Promise<RowContext> {
    const records = await this.rows(outline_version_id);
    const meta = await this.meta(outline_version_id);
    const idx = records.findIndex((r) => r.row.lesson_id === lesson_id);
    const rec = records[idx];
    if (rec === undefined) throw new InvariantViolation("lesson not in outline version", { outline_version_id, lesson_id });
    let arc_header: string | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      const r = records[i]!.row;
      if (r.kind === "arc_header") {
        arc_header = r.title;
        break;
      }
    }
    if (arc_header === null) arc_header = rec.row.arc;
    const teaching = records.filter((r) => r.row.kind === "lesson" || r.row.kind === "flex_day");
    const at = teaching.findIndex((r) => r.row.row_number === rec.row.row_number);
    const neighbours = [teaching[at - 1], teaching[at + 1]].filter((r) => r !== undefined && at >= 0).map((r) => r!.row);
    const given = choices ?? (await this.choices(outline_version_id));
    return {
      outline_version_id,
      row: rec.row,
      row_hash: rec.row_hash,
      arc_header,
      neighbours,
      unit_rules: meta.codes.unit_rules.filter((u) => u.scope_lesson_ids.includes(lesson_id)),
      links: (await this.links(outline_version_id)).filter((l) => l.from_lesson_id === lesson_id || l.to_lesson_id === lesson_id),
      choices: given.filter((c) => c.outline_version_id === outline_version_id),
    };
  }

  async upsert_choice(_choice: IntakeChoiceRow, _tx: Tx): Promise<IntakeChoiceRow> {
    throw new NotBuiltYet("NL-77");
  }
  async mark_confirmed(_id: OutlineVersionId, _at: Date, _tx: Tx): Promise<void> {
    throw new NotBuiltYet("NL-77");
  }
  async generate_gate_inputs(_id: OutlineVersionId): Promise<GateInputs> {
    throw new NotBuiltYet("NL-77");
  }

  /** Not on the port (port request recorded in the devlog): everything the unit list needs, in one transaction. */
  async unit_overview(): Promise<UnitOverviewData[]> {
    const { units, versions, rows, runs } = await this.read(async (tx) => ({
      units: (await tx.query<{ id: string; grade: number; title: string; n: number | null }>(UNITS_SQL)).rows,
      versions: (
        await tx.query<StoredVersion & { created_by: string | null }>(
          `SELECT v.id, v.unit_id, v.number, v.sha256, v.same_as_version, v.source_kind, v.uploaded_by, v.created_at, v.confirmed_at, u.name AS created_by
           FROM outline_version v LEFT JOIN app_user u ON u.id = v.uploaded_by ORDER BY v.unit_id, v.number DESC`,
        )
      ).rows,
      rows: (
        await tx.query<{ outline_version_id: string; kind: string; lesson_id: string | null; row_hash: string }>(
          "SELECT outline_version_id, kind, lesson_id, row_hash FROM outline_row WHERE kind <> 'meta'",
        )
      ).rows,
      runs: (
        await tx.query<{ unit_id: string; id: string; state: RunState }>(
          "SELECT DISTINCT ON (unit_id) unit_id, id, state FROM run ORDER BY unit_id, created_at DESC, id DESC",
        )
      ).rows,
    }));
    const by_version = new Map<string, UnitOverviewVersion["row_counts"] & { hashes: Record<string, string> }>();
    for (const r of rows) {
      const e = by_version.get(r.outline_version_id) ?? { lessons: 0, flex_days: 0, arc_headers: 0, total_rows: 0, hashes: {} };
      e.total_rows += 1;
      if (r.kind === "lesson") {
        e.lessons += 1;
        if (r.lesson_id !== null) e.hashes[r.lesson_id] = r.row_hash;
      } else if (r.kind === "flex_day") e.flex_days += 1;
      else if (r.kind === "arc_header") e.arc_headers += 1;
      by_version.set(r.outline_version_id, e);
    }
    const run_of = new Map(runs.map((r) => [r.unit_id, { run_id: r.id, state: r.state }]));
    return units.map((u) => ({
      unit: { unit_id: u.id, grade: u.grade, title: u.title, latest_outline_version_id: u.n === null ? null : `${u.id}.ov${u.n}` },
      versions: versions
        .filter((v) => v.unit_id === u.id)
        .map((v) => {
          const e = by_version.get(v.id);
          return {
            version: version_row(v),
            created_by: v.created_by ?? "(unknown)",
            row_counts: { lessons: e?.lessons ?? 0, flex_days: e?.flex_days ?? 0, arc_headers: e?.arc_headers ?? 0, total_rows: e?.total_rows ?? 0 },
            lesson_hashes: e?.hashes ?? {},
          };
        }),
      latest_run: run_of.get(u.id) ?? null,
    }));
  }
}

const UNITS_SQL = `SELECT u.id, u.grade, u.title, (SELECT max(number) FROM outline_version v WHERE v.unit_id=u.id) AS n
  FROM unit u ORDER BY u.grade, (regexp_replace(u.id, '^.*\\.U', ''))::int`;

export class PgStandardRepo implements StandardRepo {
  private readonly db: PgDatabase;
  constructor(deps: PgRepoDeps) {
    this.db = deps.db;
  }

  private async all(): Promise<StandardRow[]> {
    return this.db.with_tx(
      async (tx) =>
        (await tx.query<StandardRow>('SELECT code, "set", text, parent_code, is_leaf, eld_strand FROM standard')).rows,
    );
  }

  async index(): Promise<import("@ls/core/intake/standards-index").StandardsIndex> {
    const rows = await this.all();
    if (rows.length === 0) throw new InvariantViolation("standard table is empty; seed it");
    // Loaded lazily: the module reads files relative to its own URL at load time, which the jsdom-based
    // web tests (they import the container, hence this file) cannot do.
    const { StandardsIndex, load_eld_verdicts } = await import("@ls/core/intake/standards-index");
    verdict_cache ??= load_eld_verdicts();
    return StandardsIndex.from_rows(rows, verdict_cache);
  }

  async texts(codes: readonly string[]): Promise<StandardRow[]> {
    const rows = await this.db.with_tx(
      async (tx) =>
        (
          await tx.query<StandardRow>('SELECT code, "set", text, parent_code, is_leaf, eld_strand FROM standard WHERE code = ANY($1)', [[...codes]])
        ).rows,
    );
    const by = new Map(rows.map((r) => [r.code, r]));
    return codes.flatMap((c) => {
      const r = by.get(c);
      return r === undefined ? [] : [r];
    });
  }
}
