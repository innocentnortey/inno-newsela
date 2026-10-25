import { createHash } from "node:crypto";
import { DomainRefusal } from "@ls/core/errors";
import type { WebSettings } from "@ls/config/settings";
import { IntakeError } from "@ls/core/intake/errors";
import { compute_lesson_links } from "@ls/core/intake/lesson-links";
import { normalize_outline } from "@ls/core/intake/normalize";
import { parse_workbook } from "@ls/core/intake/parse-grid";
import type { AuditLog } from "@ls/core/ports/audit";
import type { Clock } from "@ls/core/ports/clock";
import type { RequestUser, UnitId } from "@ls/core/ports/common";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { OutlineRepo } from "@ls/core/ports/outlines";
import type { SheetFetcher } from "@ls/core/ports/sheet-fetcher";
import type { StandardRepo } from "@ls/core/ports/standards";
import type { TxRunner } from "@ls/core/ports/tx";
import { row_hash_of } from "@ls/db/repos/outlines";
import type { ImportLinkRequest, OutlineVersion, UnitList } from "@ls/schema/api/outlines";
import { UNIT_ID_RE } from "@ls/schema/ids";
import type { NormalizedRow, OutlineVersionRow } from "@ls/schema/outline";

export interface UploadedFile {
  filename: string;
  content_type: string;
  data: Uint8Array;
}

// Consumer-owned shape of the extra read the unit list needs (structurally the db repo's `unit_overview`).
export interface UnitOverviewVersion {
  version: OutlineVersionRow;
  created_by: string;
  row_counts: { lessons: number; flex_days: number; arc_headers: number; total_rows: number };
  lesson_hashes: Record<string, string>;
}
export interface UnitOverviewData {
  unit: { unit_id: string; grade: number; title: string; latest_outline_version_id: string | null };
  versions: UnitOverviewVersion[];
  latest_run: { run_id: string; state: string } | null;
}
export interface UnitOverviewReader {
  unit_overview(): Promise<UnitOverviewData[]>;
}

const FILE_MESSAGE = "That file is not a CSV or XLSX outline within the size limit.";
const COLUMNS_LOOKED_FOR = [
  "filename", "lesson", "lesson #", "type of lesson", "days", "text dependent question", "lesson description",
  "text set choice", "homework", "focus standards", "additional supported", "ca media literacy", "skill or content",
  "foundational skills focus", "vocabulary", "designated eld",
];

export function detect_kind(data: Uint8Array): "csv" | "xlsx" {
  return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04 ? "xlsx" : "csv";
}

export function sanitize_source_name(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const clean = base.replace(/[^\p{L}\p{N} ._()-]/gu, "").replace(/ +/g, " ").trim().slice(0, 80).trim();
  return clean === "" || clean === "." || clean === ".." ? "upload" : clean;
}

export function unit_key(unit_id: string): string {
  return unit_id.toLowerCase().replace(".", "-");
}

export function count_changed_lessons(prev: Record<string, string>, current: Record<string, string>): number {
  let n = 0;
  for (const [id, h] of Object.entries(current)) if (prev[id] !== h) n += 1;
  return n;
}

export function refuse_from_intake(e: IntakeError): DomainRefusal {
  switch (e.code) {
    case "UNSUPPORTED_FILE":
      return new DomainRefusal("UNSUPPORTED_FILE", FILE_MESSAGE, { reason: e.details["reason"] === "too_large" ? "too_large" : "type" });
    case "HEADER_NOT_FOUND":
      return new DomainRefusal("HEADER_NOT_FOUND", "No header row was found. Check the column names.", { columns_looked_for: COLUMNS_LOOKED_FOR });
    case "TOO_MANY_ROWS":
      return new DomainRefusal("TOO_MANY_ROWS", "The outline has too many rows. Split it.", {
        max_rows: Number(e.details["max_rows"]),
        rows: Number(e.details["rows"]),
      });
  }
}

const is_intake_error = (e: unknown): e is IntakeError => e instanceof IntakeError || (e instanceof Error && e.name === "IntakeError");

function api_version(
  v: OutlineVersionRow,
  created_by: string,
  row_counts: OutlineVersion["row_counts"],
  changed_lessons: number,
): OutlineVersion {
  return {
    outline_version_id: v.outline_version_id,
    unit_id: v.unit_id,
    unit_key: unit_key(v.unit_id),
    version_number: v.number,
    sha256: v.sha256,
    same_as_version: v.same_as_version,
    changed_lessons,
    row_counts,
    created_at: v.created_at,
    created_by,
  };
}

const lesson_hashes = (rows: readonly NormalizedRow[]): Record<string, string> =>
  Object.fromEntries(rows.filter((r) => r.kind === "lesson" && r.lesson_id !== null).map((r) => [r.lesson_id as string, row_hash_of(r)]));

export class OutlineService {
  constructor(
    private readonly outlines: OutlineRepo & UnitOverviewReader,
    private readonly standards: StandardRepo,
    private readonly sheets: SheetFetcher,
    private readonly audit: AuditLog,
    private readonly tx: TxRunner,
    ids: IdGenerator,
    private readonly clock: Clock,
    private readonly settings: Pick<WebSettings, "outline_max_bytes" | "outline_max_rows">,
  ) {
    void ids;
    void this.clock;
  }

  async list_units(user: RequestUser): Promise<UnitList> {
    void user;
    const data = await this.outlines.unit_overview();
    return {
      units: data.map((u) => ({
        unit_id: u.unit.unit_id,
        unit_key: unit_key(u.unit.unit_id),
        title: u.unit.title,
        versions: u.versions.map((cur, i) => {
          const prev = u.versions[i + 1];
          const changed = prev === undefined ? 0 : count_changed_lessons(prev.lesson_hashes, cur.lesson_hashes);
          return api_version(cur.version, cur.created_by, cur.row_counts, changed);
        }),
        latest_run: u.latest_run as UnitList["units"][number]["latest_run"],
      })),
    };
  }

  async upload(user: RequestUser, file: UploadedFile, unit_id: UnitId | null): Promise<OutlineVersion> {
    if (file.data.byteLength > this.settings.outline_max_bytes) {
      throw new DomainRefusal("UNSUPPORTED_FILE", FILE_MESSAGE, { reason: "too_large" });
    }
    const kind = detect_kind(file.data);
    return this.ingest(user, file.data, kind, kind === "xlsx" ? "upload_xlsx" : "upload_csv", sanitize_source_name(file.filename), unit_id, "outline.upload");
  }

  async import_link(user: RequestUser, req: ImportLinkRequest): Promise<OutlineVersion> {
    const f = await this.sheets.fetch_export(req.sheet_url);
    return this.ingest(user, f.data, f.kind, "sheet_link", f.url, null, "outline.import");
  }

  private async ingest(
    user: RequestUser,
    data: Uint8Array,
    kind: "csv" | "xlsx",
    source_kind: "upload_csv" | "upload_xlsx" | "sheet_link",
    source_name: string,
    unit_arg: UnitId | null,
    audit_action: string,
  ): Promise<OutlineVersion> {
    let grid;
    try {
      grid = parse_workbook(data, kind, { max_bytes: this.settings.outline_max_bytes });
    } catch (e) {
      if (is_intake_error(e)) throw refuse_from_intake(e);
      throw new DomainRefusal("UNSUPPORTED_FILE", FILE_MESSAGE, { reason: "type" });
    }
    const index = await this.standards.index();
    let outline;
    try {
      outline = normalize_outline(grid, index, this.settings.outline_max_rows);
    } catch (e) {
      if (is_intake_error(e)) throw refuse_from_intake(e);
      throw e;
    }
    const links = compute_lesson_links(outline.rows);

    const first = outline.rows.find((r) => r.lesson_id !== null)?.lesson_id ?? null;
    const found = first === null ? null : (/^(G\d{1,2}\.U\d{1,2})\./.exec(first)?.[1] ?? null);
    const unit_id = found ?? (unit_arg !== null && UNIT_ID_RE.test(unit_arg) ? unit_arg : null);
    if (unit_id === null) throw new DomainRefusal("INVALID_REQUEST", "The sheet does not say which unit it is.", { fields: ["file"] });

    const sha256 = createHash("sha256").update(data).digest("hex");
    const current = lesson_hashes(outline.rows);
    const c = outline.counts;
    const row_counts = { lessons: c.lessons, flex_days: c.flex_days, arc_headers: c.arc_headers, total_rows: c.totals };

    return this.tx.with_tx(async (tx) => {
      const row = await this.outlines.insert_version({ unit_id, sha256, source_kind, source_name, uploaded_by: user.user_id }, outline, links, tx);
      const changed =
        row.number === 1
          ? 0
          : count_changed_lessons(
              lesson_hashes((await this.outlines.rows(`${unit_id}.ov${row.number - 1}`)).map((r) => r.row)),
              current,
            );
      await this.audit.append(
        {
          actor_id: user.user_id,
          action: audit_action,
          target_kind: "outline_version",
          target_id: row.outline_version_id,
          version_hash: sha256,
          reason: null,
          details: {
            unit_id,
            version_number: row.number,
            source_kind,
            same_as_version: row.same_as_version,
            changed_lessons: changed,
            lessons: c.lessons,
            flex_days: c.flex_days,
            arc_headers: c.arc_headers,
            total_rows: c.totals,
            errors: c.errors,
            warnings: c.warnings,
          },
          request_id: user.request_id,
          store_id: null,
        },
        tx,
      );
      return api_version(row, user.name, row_counts, changed);
    });
  }
}
