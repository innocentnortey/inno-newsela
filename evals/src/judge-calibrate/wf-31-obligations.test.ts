// NL-111 AC-11: WF-31 obligations driven through the real entry point (run_judge_calibrate).
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { run_judge_calibrate } from "./main.ts";
import { FIXTURE, FLIP_4, harness, scripted_judge } from "./test-support.ts";

const REPO = path.join(import.meta.dirname, "../../..");
let h: ReturnType<typeof harness>;
let code: number;
beforeAll(async () => {
  h = harness({ judge: scripted_judge(FLIP_4), env: { OPENROUTER_API_KEY: "sk-test-NL111-key" } });
  code = await run_judge_calibrate([], h.deps);
});

describe("WF-31", () => {
  it("GR-9: nothing restricted is stored or reported", () => {
    expect(code).toBe(0);
    for (const blob of [...h.files.values(), FIXTURE, JSON.stringify(h.evidence.cases), JSON.stringify(h.call_log.starts)]) {
      expect(blob).not.toMatch(/restricted\//i);
    }
  });

  it("GR-13: no student or teacher-of-record field", () => {
    for (const blob of [FIXTURE.split("\n")[0] as string, JSON.stringify(h.evidence.cases), ...h.files.values()]) {
      expect(blob).not.toMatch(/(student|teacher_of_record)/i);
    }
  });

  it("OBS-11: WF-31 is documented, eval:judge-calibrate maps to this entry, and the run is recorded", () => {
    expect(fs.readFileSync(path.join(REPO, "docs/design/observability.md"), "utf8")).toContain("WF-31");
    const targets = JSON.parse(fs.readFileSync(path.join(REPO, "scripts/script-targets.json"), "utf8")) as Record<string, { target: string; owner: string }>;
    expect(targets["eval:judge-calibrate"]).toMatchObject({ target: "evals/src/judge-calibrate/main.ts", owner: "NL-111" });
    expect(h.evidence.runs).toHaveLength(1);
    expect(h.evidence.runs[0]).toMatchObject({ suite: "S12", passed: 26, total: 30 });
    expect(h.evidence.cases).toHaveLength(30);
  });
});
