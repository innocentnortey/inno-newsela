// NL-35 frozen tests (risk::security, money movement): AC-1, AC-2, AC-3. Do not edit.
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import type { SpendSnapshot } from "../ports/spend.ts";
import { decide_reservation } from "./reservation.ts";

const D = (s: string): Decimal => new Decimal(s);

// Day and project far below their caps unless a test overrides them.
function snap(over: Partial<SpendSnapshot> = {}): SpendSnapshot {
  return {
    run_cap_usd: D("10.00"),
    run_settled_usd: D("0"),
    run_reserved_usd: D("0"),
    user_day_cap_usd: D("26.00"),
    user_day_settled_usd: D("0"),
    user_day_reserved_usd: D("0"),
    project_ceiling_usd: D("75.00"),
    project_settled_usd: D("0"),
    project_reserved_usd: D("0"),
    ...over,
  };
}

describe("decide_reservation", () => {
  it("run_cap_inclusive [invariant]: spent + reserved + amount == cap is allowed; one micro-dollar over is refused", () => {
    const s = snap({ run_settled_usd: D("6.00"), run_reserved_usd: D("3.00") });
    const ok = decide_reservation(s, D("1.00"));
    expect(ok.allowed).toBe(true);
    expect(ok.refused_by).toBeNull();

    const no = decide_reservation(s, D("1.000001"));
    expect(no.allowed).toBe(false);
    expect(no.refused_by).toBe("run_cap");
    expect(no.scope).toBeNull();
    expect(no.reservation_id).toBeNull();
    expect(no.snapshot).toBe(s);
    expect(no.snapshot.run_settled_usd.equals(D("6.00"))).toBe(true);
    expect(no.snapshot.run_reserved_usd.equals(D("3.00"))).toBe(true);
  });

  describe("cap_order_scope_remaining", () => {
    it("cap_order_scope_remaining [invariant]: run, day and project all breached -> run_cap first", () => {
      const s = snap({
        run_settled_usd: D("10.00"),
        user_day_settled_usd: D("26.00"),
        project_settled_usd: D("75.00"),
      });
      const d = decide_reservation(s, D("1.00"));
      expect(d.allowed).toBe(false);
      expect(d.refused_by).toBe("run_cap");
      expect(d.scope).toBeNull();
    });

    it("cap_order_scope_remaining [invariant]: run null (assist), day and project breached -> day_cap, scope user", () => {
      const s = snap({
        run_cap_usd: null,
        user_day_settled_usd: D("26.00"),
        project_settled_usd: D("75.00"),
      });
      const d = decide_reservation(s, D("1.00"));
      expect(d.allowed).toBe(false);
      expect(d.refused_by).toBe("day_cap");
      expect(d.scope).toBe("user");
      expect(d.remaining_usd?.equals(D("0"))).toBe(true);
    });

    it("cap_order_scope_remaining [invariant]: only the project ceiling breached (74.50 of 75.00, amount 0.60) -> project_cap, scope project, remaining 0.50", () => {
      const s = snap({ project_settled_usd: D("74.50") });
      const d = decide_reservation(s, D("0.60"));
      expect(d.allowed).toBe(false);
      expect(d.refused_by).toBe("project_cap");
      expect(d.scope).toBe("project");
      expect(d.remaining_usd?.equals(D("0.50"))).toBe(true);
      expect(d.reservation_id).toBeNull();
    });

    it("cap_order_scope_remaining [boundary]: remaining_usd is never negative when spend is already past the cap", () => {
      const s = snap({ run_settled_usd: D("11.30") }); // overshoot recorded earlier
      const d = decide_reservation(s, D("0.01"));
      expect(d.refused_by).toBe("run_cap");
      expect(d.remaining_usd).not.toBeNull();
      expect(d.remaining_usd!.gte(0)).toBe(true);
      expect(d.remaining_usd!.equals(D("0"))).toBe(true);
    });
  });

  it("assist_ignores_run_cap [invariant]: run_cap_usd null with day and project headroom allows an amount larger than any run cap", () => {
    const s = snap({ run_cap_usd: null, run_settled_usd: D("500"), run_reserved_usd: D("500") });
    const d = decide_reservation(s, D("20.00"));
    expect(d.allowed).toBe(true);
    expect(d.refused_by).toBeNull();
    expect(d.reservation_id).toBeNull();
  });
});
