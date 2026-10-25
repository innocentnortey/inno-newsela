import { describe, expect, it } from "vitest";
import { InvariantViolation } from "@ls/core/errors";
import { model_id_for } from "./model-client.ts";

const s = { model_generation_id: "gen-1", model_repair_id: "rep-1", model_assist_id: "ast-1" };

describe("model_id_for", () => {
  it("maps the three Anthropic aliases", () => {
    expect(model_id_for("GENERATION", s)).toBe("gen-1");
    expect(model_id_for("REPAIR", s)).toBe("rep-1");
    expect(model_id_for("ASSIST", s)).toBe("ast-1");
  });
  it("[boundary] JUDGE throws", () => {
    expect(() => model_id_for("JUDGE", s)).toThrow(InvariantViolation);
  });
});
