import { describe, expect, it } from "vitest";
import { CHECK_POLICY } from "./policy.ts";

describe("CHECK_POLICY", () => {
  it("holds the SP-3 values and is frozen", () => {
    expect(CHECK_POLICY.quote_span_min_words).toBe(3);
    expect(CHECK_POLICY.reviewer_quote_max_words).toBe(12);
    expect(CHECK_POLICY.quote_and_page_scans).toBe("blocking_everywhere");
    expect(CHECK_POLICY.name_scan_scope).toBe("blocking_in_cfu_items");
    expect(CHECK_POLICY.name_scan_engine).toBe("heuristic_plus_compromise");
    expect(CHECK_POLICY.minutes_target).toBe(50);
    expect(CHECK_POLICY.minutes_tolerance).toBe(5);
    expect(CHECK_POLICY.vocabulary_cap).toBe(6);
    expect(CHECK_POLICY.safety_run_min_words).toBe(6);
    expect(Object.isFrozen(CHECK_POLICY)).toBe(true);
  });
});
