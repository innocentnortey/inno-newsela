// NL-107: the S6 suite adapter. No database and no scenario runs here: case list, refusal, and what score() reports.
import { describe, expect, it } from "vitest";
import { InvariantViolation } from "@ls/core/errors";
import { make_s6 } from "./s6.ts";

const OPTS = { repeat: 1, provider_mode: "stub", git_sha: "x", unit: null } as const;

describe("S6 suite", () => {
  it("lists the four HP-7 invariants as synthetic cases", () => {
    const cases = make_s6("stub").cases();
    expect(cases.map((c) => c.case_id)).toEqual(["kill", "rate_limit", "truncation", "cap"]);
    for (const c of cases) {
      expect(c.provenance).toBe("synthetic");
      expect(c.source).toBe("HP-7");
      expect(c.input_path).toBe("evals/src/suites/s6-scenarios.ts");
    }
  });

  it("limits the list to the named scenarios", () => {
    expect(make_s6("stub", ["cap"]).cases().map((c) => c.case_id)).toEqual(["cap"]);
  });

  it("real_refused: cases() and score() throw InvariantViolation on a real provider", async () => {
    const suite = make_s6("real");
    expect(() => suite.cases()).toThrow(InvariantViolation);
    expect(() => suite.cases()).toThrow("S6 runs on the stub provider only");
    const stub = make_s6("stub");
    await expect(stub.score(stub.cases()[0]!, { ...OPTS, provider_mode: "real" })).rejects.toBeInstanceOf(InvariantViolation);
  });

  it("rejects a case it does not know", async () => {
    const suite = make_s6("stub");
    await expect(suite.score({ ...suite.cases()[0]!, case_id: "nope" }, OPTS)).rejects.toBeInstanceOf(InvariantViolation);
  });
});
