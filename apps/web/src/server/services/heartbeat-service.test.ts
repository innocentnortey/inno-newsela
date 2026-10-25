// NL-48
import { DomainRefusal } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import type { LessonId, RequestUser } from "@ls/core/ports/common";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { Heartbeat } from "@ls/schema/api/review";
import { describe, expect, it } from "vitest";
import { HeartbeatService } from "./heartbeat-service.ts";
import { InMemoryMetricsRepo, known_lessons } from "./metrics-test-fakes.ts";

const START = new Date("2026-10-01T10:00:00.000Z");
const ids = new PrefixedIdGenerator();
const settings = { heartbeat_merge_gap_s: 60, heartbeat_min_spacing_s: 10 };
const L1 = "G6.U4.L1" as LessonId;
const L3 = "G6.U4.L3" as LessonId;
const L4 = "G6.U4.L4" as LessonId;

const user = (role: RequestUser["role"], synthetic = false): RequestUser => ({
  user_id: ids.new_id("usr"), name: "Test Reviewer", email: "r@example.test", role, synthetic, request_id: "req_x" as RequestUser["request_id"],
});

function setup() {
  const repo = new InMemoryMetricsRepo();
  const clock = new FakeClock(START);
  const svc = new HeartbeatService(repo, clock, settings, known_lessons([L1, L3, L4]));
  return { repo, clock, svc };
}
const hb = (clock: FakeClock, tab: string, version: string, over: Partial<Heartbeat> = {}): Heartbeat => ({
  tab_id: tab, focused: true, visible: true, last_input_at: clock.now().toISOString(), sent_at: clock.now().toISOString(), version_id: version, ...over,
});

describe("HeartbeatService", () => {
  it("scripted_review", async () => {
    const { repo, clock, svc } = setup();
    const u = user("reviewer");
    const v = { [L1]: ids.new_id("lv"), [L3]: ids.new_id("lv"), [L4]: ids.new_id("lv") };
    // one beat per tab every 15 s for each scripted segment; clock advances 5 s steps, so tab B is offset +5 s
    type Seg = { lesson: LessonId; tab: string; from: number; to: number; active: boolean };
    const script: Seg[] = [
      { lesson: L1, tab: "A", from: 0, to: 240, active: true },
      { lesson: L1, tab: "A", from: 255, to: 540, active: false },
      { lesson: L1, tab: "B", from: 260, to: 540, active: false },
      { lesson: L1, tab: "A", from: 540, to: 900, active: true },
      { lesson: L1, tab: "B", from: 605, to: 900, active: true },
      { lesson: L3, tab: "A", from: 1000, to: 1360, active: true },
      { lesson: L4, tab: "A", from: 1500, to: 1980, active: true },
      { lesson: L4, tab: "B", from: 1800, to: 1980, active: true },
    ];
    const events: Array<{ t: number; seg: Seg }> = [];
    for (const seg of script) for (let t = seg.from; t <= seg.to; t += 15) events.push({ t, seg });
    events.sort((a, b) => a.t - b.t);
    let now = 0;
    let after_gap: number | null = null;
    let before_gap: number | null = null;
    for (const e of events) {
      clock.advance((e.t - now) * 1000);
      now = e.t;
      const idle = !e.seg.active;
      const last_input = idle ? new Date(clock.now().getTime() - 300_000).toISOString() : clock.now().toISOString();
      await svc.record(u, e.seg.lesson, hb(clock, e.seg.tab, v[e.seg.lesson] as string, { focused: !idle, last_input_at: last_input }));
      const l1 = repo.sessions.find((s) => s.lesson_id === L1);
      if (e.t === 240) before_gap = l1?.active_seconds ?? null;
      if (e.t === 540) after_gap = l1?.active_seconds ?? null;
    }
    const minutes = (l: LessonId) => repo.sessions.filter((s) => s.lesson_id === l).reduce((n, s) => n + s.active_seconds, 0) / 60;
    expect(Math.abs(minutes(L1) - 10)).toBeLessThanOrEqual(1);
    expect(Math.abs(minutes(L3) - 6)).toBeLessThanOrEqual(1);
    expect(Math.abs(minutes(L4) - 8)).toBeLessThanOrEqual(1);
    expect(before_gap).not.toBeNull();
    expect((after_gap ?? 0) - (before_gap ?? 0)).toBeLessThanOrEqual(60);
    expect(repo.sessions).toHaveLength(3);
  });

  it("author_forbidden_writes_nothing", async () => {
    const { repo, clock, svc } = setup();
    await expect(svc.record(user("author"), L1, hb(clock, "A", "lv_1"))).rejects.toMatchObject({ code: "ROLE_FORBIDDEN" });
    expect(repo.heartbeats).toHaveLength(0);
    expect(repo.sessions).toHaveLength(0);
  });

  it("unknown_lesson_not_found", async () => {
    const { repo, clock, svc } = setup();
    const p = svc.record(user("reviewer"), "G6.U4.L99" as LessonId, hb(clock, "A", "lv_1"));
    await expect(p).rejects.toBeInstanceOf(DomainRefusal);
    await expect(p).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(repo.heartbeats).toHaveLength(0);
  });

  it("idle_beats_add_zero", async () => {
    const { repo, clock, svc } = setup();
    const u = user("reviewer");
    await svc.record(u, L1, hb(clock, "A", "lv_1"));
    clock.advance(15_000);
    await svc.record(u, L1, hb(clock, "A", "lv_1", { focused: false }));
    clock.advance(15_000);
    const stale = new Date(clock.now().getTime() - 90_000).toISOString();
    await svc.record(u, L1, hb(clock, "A", "lv_1", { last_input_at: stale }));
    expect(repo.heartbeats.map((h) => h.active)).toEqual([true, false, false]);
    expect(repo.sessions[0]?.active_seconds).toBe(0);
  });

  it("spacing_five_seconds", async () => {
    const { repo, clock, svc } = setup();
    const u = user("reviewer");
    await svc.record(u, L1, hb(clock, "A", "lv_1"));
    clock.advance(5000);
    await svc.record(u, L1, hb(clock, "A", "lv_1"));
    expect(repo.heartbeats).toHaveLength(2);
    expect(repo.sessions).toHaveLength(1);
    expect(repo.sessions[0]?.active_seconds).toBe(0);
    clock.advance(10_000);
    await svc.record(u, L1, hb(clock, "A", "lv_1"));
    expect(repo.sessions[0]?.active_seconds).toBe(15);
  });

  it("synthetic_flag_copied", async () => {
    const { repo, clock, svc } = setup();
    await svc.record(user("reviewer", true), L1, hb(clock, "A", "lv_1"));
    expect(repo.heartbeats[0]?.synthetic).toBe(true);
    expect(repo.sessions[0]?.synthetic).toBe(true);
  });
});
