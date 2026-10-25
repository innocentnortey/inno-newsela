// NL-48
import { describe, expect, it } from "vitest";
import type { HeartbeatRecord } from "../ports/metrics.ts";
import { merge_heartbeats } from "./sessions.ts";

const T0 = Date.parse("2026-10-01T10:00:00.000Z");
const beat = (tab: string, s: number, over: Partial<HeartbeatRecord> = {}): HeartbeatRecord => ({
  user_id: "usr_a" as HeartbeatRecord["user_id"],
  tab_id: tab,
  lesson_id: "G6.U4.L1" as HeartbeatRecord["lesson_id"],
  version_id: "lv_1" as HeartbeatRecord["version_id"],
  at: new Date(T0 + s * 1000),
  active: true,
  synthetic: false,
  ...over,
});
const every15 = (tab: string, from: number, to: number) => {
  const out: HeartbeatRecord[] = [];
  for (let s = from; s <= to; s += 15) out.push(beat(tab, s));
  return out;
};
const minutes = (iv: { start: Date; end: Date }[]) => iv.reduce((n, i) => n + (i.end.getTime() - i.start.getTime()), 0) / 60000;

describe("merge_heartbeats", () => {
  it("two_tabs_merge_to_ten_minutes", () => {
    const b = [...every15("A", 0, 600), ...every15("B", 367, 600).map((x) => x)];
    const iv = merge_heartbeats(b, 60);
    expect(iv).toHaveLength(1);
    expect(minutes(iv)).toBe(10);
  });
  it("idle_tab_adds_zero", () => {
    const b = [beat("A", 0), beat("A", 15, { active: false }), beat("B", 30, { active: false })];
    const iv = merge_heartbeats(b, 60);
    expect(minutes(iv)).toBe(0);
    expect(iv).toHaveLength(1);
    expect(merge_heartbeats([beat("A", 0, { active: false })], 60)).toEqual([]);
  });
  it("gap_splits_intervals", () => {
    const iv = merge_heartbeats([beat("A", 0), beat("A", 30), beat("A", 120), beat("A", 150)], 60);
    expect(iv).toHaveLength(2);
    expect(minutes(iv)).toBe(1);
  });
  it("spacing_skips_close_beats", () => {
    const iv = merge_heartbeats([beat("A", 0), beat("A", 5)], 60);
    expect(minutes(iv)).toBe(0);
    expect(merge_heartbeats([beat("A", 0), beat("A", 5), beat("A", 15)], 60).map((i) => i.end.getTime() - i.start.getTime())).toEqual([15000]);
  });
  it("synthetic_carried", () => {
    const iv = merge_heartbeats([beat("A", 0, { synthetic: true }), beat("A", 15, { synthetic: true })], 60);
    expect(iv[0]?.synthetic).toBe(true);
  });
});
