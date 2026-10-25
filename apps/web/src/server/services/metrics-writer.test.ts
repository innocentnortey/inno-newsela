// NL-48
import Decimal from "decimal.js";
import type { WebSettings } from "@ls/config/settings";
import { FakeClock } from "@ls/core/ports/clock";
import type { LessonId } from "@ls/core/ports/common";
import type { LessonVersionRow } from "@ls/core/ports/lesson-versions";
import type { ReviewSessionRow } from "@ls/core/ports/metrics";
import { describe, expect, it } from "vitest";
import { InMemoryMetricsRepo } from "./metrics-test-fakes.ts";
import { MetricsWriter } from "./metrics-writer.ts";

const L = "G6.U4.L1" as LessonId;
const ver = { version_id: "lv_1", lesson_id: L, teacher_word_count: 1250 } as unknown as LessonVersionRow;
const sess = (secs: number, synthetic: boolean): ReviewSessionRow => ({
  user_id: "usr_a" as ReviewSessionRow["user_id"], lesson_id: L, version_id: "lv_1" as ReviewSessionRow["version_id"],
  started_at: new Date(0), last_at: new Date(secs * 1000), active_seconds: secs, synthetic,
});

describe("MetricsWriter", () => {
  it("first_row_once", async () => {
    const repo = new InMemoryMetricsRepo();
    const clock = new FakeClock(new Date("2026-10-01T10:00:00.000Z"));
    const w = new MetricsWriter(repo, {} as WebSettings, clock);
    repo.sessions.push(sess(600, false), sess(6000, true));
    const tx = {};
    const first = await w.write_first_approval(L, ver, "usable_as_drafted", tx);
    expect(first.written).toBe(true);
    expect(first.human_sessions).toBe(1);
    expect(first.active_minutes?.equals(new Decimal(10))).toBe(true);
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]?.g2_threshold_minutes.toString()).toBe("2.5");
    const snapshot = JSON.stringify(repo.rows[0]);
    repo.sessions.push(sess(300, false));
    clock.advance(86_400_000);
    const second = await w.write_first_approval(L, ver, "rewritten", tx);
    expect(second).toEqual({ written: false, active_minutes: null, human_sessions: 0 });
    expect(repo.rows).toHaveLength(1);
    expect(JSON.stringify(repo.rows[0])).toBe(snapshot);
  });
});
