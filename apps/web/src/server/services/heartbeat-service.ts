// NL-48: records one review heartbeat. Returns nothing: no minutes ever leave this service.
import type { WebSettings } from "@ls/config/settings";
import { DomainRefusal } from "@ls/core/errors";
import type { Clock } from "@ls/core/ports/clock";
import type { LessonId, RequestUser } from "@ls/core/ports/common";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { HeartbeatRecord, MetricsRepo } from "@ls/core/ports/metrics";
import type { Heartbeat } from "@ls/schema/api/review";

export type LessonLookup = Pick<LessonStateRepo, "get">;
export type HeartbeatSettings = Pick<WebSettings, "heartbeat_merge_gap_s" | "heartbeat_min_spacing_s">;

const SPACING_MAP_LIMIT = 5000;

export class HeartbeatService {
  // Last kept beat per (user, tab, lesson), in this process only (single-container demo).
  private readonly last_kept = new Map<string, number>();

  constructor(
    private readonly metrics: MetricsRepo,
    private readonly clock: Clock,
    private readonly settings: HeartbeatSettings,
    private readonly lessons: LessonLookup,
  ) {}

  async record(user: RequestUser, lesson_id: LessonId, hb: Heartbeat): Promise<void> {
    if (user.role === "author") throw new DomainRefusal("ROLE_FORBIDDEN", "Your role cannot do this.");
    if ((await this.lessons.get(lesson_id)) === null) throw new DomainRefusal("NOT_FOUND", "Not found.");
    const gap_s = this.settings.heartbeat_merge_gap_s;
    const now = this.clock.now();
    const active =
      hb.focused && hb.visible && Date.parse(hb.sent_at) - Date.parse(hb.last_input_at) <= gap_s * 1000;
    const rec: HeartbeatRecord = {
      user_id: user.user_id, tab_id: hb.tab_id, lesson_id, version_id: hb.version_id as HeartbeatRecord["version_id"],
      at: now, active, synthetic: user.synthetic,
    };
    await this.metrics.insert_heartbeat(rec);

    const key = `${user.user_id}|${hb.tab_id}|${lesson_id}`;
    const now_ms = now.getTime();
    const prev = this.last_kept.get(key);
    if (prev !== undefined && now_ms - prev < this.settings.heartbeat_min_spacing_s * 1000) return;
    this.last_kept.set(key, now_ms);
    if (this.last_kept.size > SPACING_MAP_LIMIT) {
      for (const [k, v] of this.last_kept) if (now_ms - v > gap_s * 1000) this.last_kept.delete(k);
    }
    await this.metrics.extend_session(rec, gap_s);
  }
}
