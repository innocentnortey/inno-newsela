import type { ExportBundleFile } from "@ls/schema/export";
import type { LessonId, Sha256, UnitId, UserId, VersionId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface HeldBackRecord {
  lesson_id: LessonId;
  reason: string;
  waits_on: LessonId;
}

export interface NewExportBundle {
  unit_id: UnitId;
  payload_sha256: Sha256;
  lesson_versions: VersionId[];
  held_back: HeldBackRecord[];
  payload: ExportBundleFile;
  created_by: UserId;
}

export interface ExportBundleRow {
  export_id: string;
  unit_id: UnitId;
  version_number: number;
  payload_sha256: Sha256;
  lesson_versions: VersionId[];
  held_back: HeldBackRecord[];
  created_by: UserId;
  created_at: Date;
}

export interface ExportRepo {
  // runs under an advisory lock per unit; an unchanged payload hash returns latest() without writing
  insert(b: NewExportBundle, tx: Tx): Promise<ExportBundleRow>;
  latest(unit_id: UnitId): Promise<ExportBundleRow | null>;
  all_for_unit(unit_id: UnitId): Promise<ExportBundleRow[]>;
  payload(export_id: string): Promise<ExportBundleFile | null>;
}
