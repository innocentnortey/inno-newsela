// GEN-8: real mode without MODEL_JUDGE_ID means "judge off" with a log line, not a worker that refuses to start.
import { describe, expect, it } from "vitest";
import { wire_judge } from "./judge.ts";
import type { WorkerDeps } from "../deps-types.ts";

describe("wire_judge without a judge model id", () => {
  it("returns no lane and logs judge.disabled", () => {
    const lines: Array<[string, unknown]> = [];
    const d = {
      db: {}, ids: {}, clock: {},
      settings: { model: { model_provider_mode: "real" }, model_judge_id: null, openrouter_api_key: null },
      logger: { warn: (m: string, x: unknown) => lines.push([m, x]), info: () => {}, error: () => {}, debug: () => {} },
    } as unknown as WorkerDeps;
    const w = wire_judge(d);
    expect(w).toEqual({ claim_loop: null, lane: null });
    expect(lines[0]?.[0]).toBe("judge.disabled");
    expect(JSON.stringify(lines[0]?.[1])).toContain("no_judge_model_id");
  });
});
