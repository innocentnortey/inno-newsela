// AC-5: TransitionRequestInput differs from TransitionRequest in exactly rating, note and reason.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TransitionRequest, TransitionRequestInput } from "../../src/api/transition.ts";
import { collectExamples, loadSpec } from "./oracle.ts";

const hash = "a".repeat(64);
const transitionExamples = collectExamples(loadSpec()).filter(
  (e) => e.schemaName === "TransitionRequest",
);

type JsonObj = Record<string, unknown>;
function variants(schema: unknown): JsonObj[] {
  const s = schema as { oneOf?: JsonObj[]; anyOf?: JsonObj[] };
  return (s.oneOf ?? s.anyOf ?? []) as JsonObj[];
}
function requiredOf(v: JsonObj): string[] {
  return (v.required as string[] | undefined) ?? [];
}
function actionOf(v: JsonObj): string {
  const a = (v.properties as Record<string, { const?: string }>).action;
  return a!.const!;
}

describe("CHG-3 optional pin on request_changes and reopen", () => {
  const pin = { snapshot_hash: hash, snapshot_state_vector: "AQID" };
  it.each([
    ["request_changes", { action: "request_changes", tag: "other", note: "n" }],
    ["reopen", { action: "reopen", reason: "r" }],
  ] as const)("%s parses with and without the pair; unknown keys still fail", (_a, body) => {
    for (const schema of [TransitionRequest, TransitionRequestInput]) {
      expect(schema.safeParse(body).success).toBe(true);
      expect(schema.safeParse({ ...body, ...pin }).success).toBe(true);
      expect(schema.safeParse({ ...body, ...pin, extra: 1 }).success).toBe(false);
      expect(schema.safeParse({ ...body, snapshot_hash: "nope", snapshot_state_vector: "AQID" }).success).toBe(false);
    }
  });
});

describe("TransitionRequestInput", () => {
  it("has transition examples", () => {
    expect(transitionExamples.length).toBeGreaterThan(0);
  });
  it.each(transitionExamples.map((e) => [e.where, e.value] as const))("%s parses with both", (_w, v) => {
    expect(TransitionRequest.safeParse(v).success).toBe(true);
    expect(TransitionRequestInput.safeParse(v).success).toBe(true);
  });
  it("approve without rating parses with Input, not with the strict request", () => {
    const body = { action: "approve", snapshot_hash: hash, snapshot_state_vector: "AQID" };
    expect(TransitionRequestInput.safeParse(body).success).toBe(true);
    expect(TransitionRequest.safeParse(body).success).toBe(false);
  });
  it("request_changes without note parses with Input", () => {
    expect(TransitionRequestInput.safeParse({ action: "request_changes", tag: "other" }).success).toBe(true);
  });
  it("reopen without reason parses with Input", () => {
    expect(TransitionRequestInput.safeParse({ action: "reopen" }).success).toBe(true);
  });
  it("unknown action fails", () => {
    expect(TransitionRequestInput.safeParse({ action: "delete" }).success).toBe(false);
  });
  it("extra key fails", () => {
    expect(TransitionRequestInput.safeParse({ action: "reopen", reason: "r", extra: 1 }).success).toBe(false);
  });
  it("JSON Schema differs only in required rating, note and reason", () => {
    const strict = variants(z.toJSONSchema(TransitionRequest, { io: "input" }));
    const loose = variants(z.toJSONSchema(TransitionRequestInput, { io: "input" }));
    expect(strict).toHaveLength(6);
    expect(loose).toHaveLength(6);
    const differing: string[] = [];
    for (const s of strict) {
      const l = loose.find((x) => actionOf(x) === actionOf(s))!;
      for (const key of requiredOf(s)) if (!requiredOf(l).includes(key)) differing.push(key);
    }
    expect(differing.sort()).toEqual(["note", "rating", "reason"]);
  });
});
