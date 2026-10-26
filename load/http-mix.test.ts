// NL-118 (AC-1): the schedule reproduces the capacity doc's mix.
import { describe, expect, it } from "vitest";
import { build_schedule, rate_in_window, roles_in_order, split_roles, vu_id, type EventKind } from "./http-mix.ts";

const SHAPE = { users: 200, ramp_s: 120, plateau_s: 900, ramp_down_s: 120 };

describe("http mix schedule", () => {
  it("schedule_matches_capacity_doc", () => {
    const ev = build_schedule(SHAPE);
    const want: Record<string, number> = { heartbeat: 140 / 15, poll: 40 / 2, act: 20 / 10, page: 200 / 30 };
    for (const [kind, rate] of Object.entries(want)) {
      const got = rate_in_window(ev, kind as EventKind, 300, 360);
      console.log(`${kind}: ${got.toFixed(2)}/s (want ${rate.toFixed(2)}, bounds ${(rate * 0.9).toFixed(2)}..${(rate * 1.1).toFixed(2)})`);
      expect(got).toBeGreaterThanOrEqual(rate * 0.9);
      expect(got).toBeLessThanOrEqual(rate * 1.1);
    }
    expect(split_roles(200)).toEqual({ reviewers: 140, pollers: 40, actors: 20 });
    const five = split_roles(5);
    expect(five.reviewers + five.pollers + five.actors).toBe(5);
    expect(build_schedule(SHAPE)).toEqual(ev);
    expect(build_schedule(SHAPE, 7)).not.toEqual(ev);
    for (let i = 1; i < ev.length; i++) expect(ev[i]!.t_ms).toBeGreaterThanOrEqual(ev[i - 1]!.t_ms);
    expect(new Set(ev.map((e) => e.vu)).size).toBe(200);
    expect(ev.filter((e) => e.kind === "open")).toHaveLength(140);
  });

  it("roles interleave so any ramp prefix has the mix", () => {
    const roles = roles_in_order(200);
    const first50 = roles.slice(0, 50);
    expect(first50.filter((r) => r === "reviewer").length).toBeGreaterThanOrEqual(34);
    expect(roles.filter((r) => r === "actor")).toHaveLength(20);
    expect(vu_id(0)).toBe("vu-001");
  });
});
