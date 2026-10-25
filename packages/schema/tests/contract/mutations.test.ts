// AC-3: removing a required field fails; unknown keys fail on every request body; ProseMirrorDoc stays open.
import { describe, expect, it } from "vitest";
import { collectExamples, loadSpec, mirrors, type Spec } from "./oracle.ts";
import { ProseMirrorDoc } from "../../src/api/common.ts";
import * as transition from "../../src/api/transition.ts";

const spec: Spec = loadSpec();
const examples = collectExamples(spec);
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function requiredOf(name: string): string[] {
  const s = spec.components.schemas[name];
  return Array.isArray(s?.required) ? s.required : [];
}

// One case per (example, required key); items of array examples are checked individually.
const missingCases = examples.flatMap((e) => {
  const items = e.isArrayItems ? (e.value as unknown[]) : [e.value];
  return items.flatMap((item, i) =>
    isObject(item)
      ? requiredOf(e.schemaName)
          .filter((k) => k in item)
          .map((k) => ({ label: `${e.where}[${i}] without ${k}`, name: e.schemaName, item, key: k }))
      : [],
  );
});

describe("required fields", () => {
  it("has at least one case per object example", () => {
    const objectExamples = examples.filter((e) => e.isArrayItems || isObject(e.value)).length;
    expect(missingCases.length).toBeGreaterThanOrEqual(objectExamples);
  });
  it.each(missingCases.map((c) => [c.label, c] as const))("%s fails", (_l, c) => {
    const copy = { ...c.item };
    delete copy[c.key];
    expect(mirrors[c.name]!.safeParse(copy).success).toBe(false);
  });
});

describe("unknown keys on requests", () => {
  const requestNames = Object.keys(spec.components.schemas).filter((n) => n.endsWith("Request"));
  const requestExamples = examples.filter(
    (e) => requestNames.includes(e.schemaName) && isObject(e.value),
  );
  it("covers every *Request component that has an example", () => {
    expect(requestExamples.length).toBeGreaterThan(0);
  });
  it.each(requestExamples.map((e) => [e.where, e] as const))("%s rejects __unknown", (_w, e) => {
    const r = mirrors[e.schemaName]!.safeParse({ ...(e.value as object), __unknown: 1 });
    expect(r.success).toBe(false);
  });
  it.each(requestNames)("%s rejects __unknown on a minimal valid body", (name) => {
    // Build a body by borrowing the example when one exists, else an empty object (RegenerateRequest).
    const ex = examples.find((e) => e.schemaName === name);
    const base = ex && isObject(ex.value) ? ex.value : {};
    const mirror = mirrors[name]!;
    if (!ex) expect(mirror.safeParse(base).success).toBe(true);
    expect(mirror.safeParse({ ...base, __unknown: 1 }).success).toBe(false);
  });
  it.each([
    ["StartReview", { action: "start_review" }],
    ["Submit", { action: "submit", client_state_vector: "AQID" }],
    ["Withdraw", { action: "withdraw" }],
    ["Approve", { action: "approve", snapshot_hash: "a".repeat(64), snapshot_state_vector: "AQID", rating: "rewritten" }],
    ["RequestChanges", { action: "request_changes", tag: "other", note: "n" }],
    ["Reopen", { action: "reopen", reason: "r" }],
  ] as const)("TransitionRequest variant %s rejects __unknown", (name, body) => {
    expect(transition[name].safeParse(body).success).toBe(true);
    expect(transition[name].safeParse({ ...body, __unknown: 1 }).success).toBe(false);
    expect(transition.TransitionRequest.safeParse({ ...body, __unknown: 1 }).success).toBe(false);
  });
});

describe("ProseMirrorDoc", () => {
  it("accepts extra keys (additionalProperties: true)", () => {
    expect(ProseMirrorDoc.safeParse({ type: "doc", content: [], extra: 1 }).success).toBe(true);
  });
  it("still requires type doc", () => {
    expect(ProseMirrorDoc.safeParse({ content: [] }).success).toBe(false);
  });
});
