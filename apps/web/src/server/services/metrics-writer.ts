// NL-48: writes the one frozen first-approval metrics row. Rework never edits it.
import type Decimal from "decimal.js";
import type { WebSettings } from "@ls/config/settings";
import { compute_lesson_metrics } from "@ls/core/metrics/frozen-row";
import { SystemClock, type Clock } from "@ls/core/ports/clock";
import type { DraftRating, LessonId } from "@ls/core/ports/common";
import type { LessonVersionRow } from "@ls/core/ports/lesson-versions";
import type { MetricsRepo } from "@ls/core/ports/metrics";
import type { Tx } from "@ls/core/ports/tx";

export interface MetricsWriteResult {
  written: boolean;
  active_minutes: Decimal | null;
  human_sessions: number;
}

export class MetricsWriter {
  constructor(
    private readonly metrics: MetricsRepo,
    // Accepted for the DO-4 signature; no setting is read today.
    private readonly _settings: WebSettings,
    private readonly clock: Clock = new SystemClock(),
  ) {
    void this._settings;
  }

  async write_first_approval(lesson_id: LessonId, version: LessonVersionRow, rating: DraftRating, tx: Tx): Promise<MetricsWriteResult> {
    if (await this.metrics.first_approval_exists(lesson_id, tx)) {
      return { written: false, active_minutes: null, human_sessions: 0 };
    }
    const sessions = await this.metrics.sessions_for(lesson_id);
    const row = compute_lesson_metrics(sessions, version, rating, this.clock.now());
    const written = await this.metrics.write_lesson_metrics(row, tx);
    return { written, active_minutes: written ? row.active_minutes : null, human_sessions: written ? row.human_sessions : 0 };
  }
}
