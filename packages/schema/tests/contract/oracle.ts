// Test oracle for NL-11: loads interface.openapi.yaml and collects every example with the component it must satisfy.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { z } from "zod";
import * as board from "../../src/api/board.ts";
import * as collab from "../../src/api/collab.ts";
import * as common from "../../src/api/common.ts";
import * as exportsApi from "../../src/api/exports.ts";
import * as lessons from "../../src/api/lessons.ts";
import * as metrics from "../../src/api/metrics.ts";
import * as outlines from "../../src/api/outlines.ts";
import * as prompts from "../../src/api/prompts.ts";
import * as review from "../../src/api/review.ts";
import * as runs from "../../src/api/runs.ts";
import * as session from "../../src/api/session.ts";
import * as transition from "../../src/api/transition.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Spec = any;

export function loadSpec(): Spec {
  const url = new URL("../../../../docs/contracts/interface.openapi.yaml", import.meta.url);
  return parse(readFileSync(url, "utf8"));
}

const modules: Record<string, unknown>[] = [
  common, session, outlines, runs, board, lessons, review, transition, metrics, exportsApi, prompts, collab,
];

/** Every exported zod schema, by export name (type aliases are not runtime values, so only schemas appear). */
export const mirrors: Record<string, z.ZodType> = {};
for (const m of modules) {
  for (const [name, value] of Object.entries(m)) {
    if (typeof value === "object" && value !== null && "safeParse" in value) {
      mirrors[name] = value as z.ZodType;
    }
  }
}

export interface Example {
  where: string;
  schemaName: string;
  isArrayItems: boolean;
  value: unknown;
}

function refName(ref: string): string {
  return ref.slice(ref.lastIndexOf("/") + 1);
}

/** Resolve a media type object to the component the example must satisfy. */
function schemaOf(media: Spec): { name: string; items: boolean } | undefined {
  const s = media?.schema;
  if (!s) return undefined;
  if (typeof s.$ref === "string") return { name: refName(s.$ref), items: false };
  if (s.type === "array" && typeof s.items?.$ref === "string") {
    return { name: refName(s.items.$ref), items: true };
  }
  return undefined;
}

/** Walk the whole document: every `examples.<k>.value` or `example` under a media type. */
export function collectExamples(spec: Spec): Example[] {
  const out: Example[] = [];
  const visit = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((x, i) => visit(x, `${path}/${i}`));
      return;
    }
    if (node === null || typeof node !== "object") return;
    const obj = node as Record<string, Spec>;
    if (obj.schema !== undefined && (obj.examples !== undefined || obj.example !== undefined)) {
      const target = schemaOf(obj);
      const push = (key: string, value: unknown): void => {
        out.push({
          where: `${path}/${key}`,
          schemaName: target?.name ?? "(unresolved)",
          isArrayItems: target?.items ?? false,
          value,
        });
      };
      if (obj.examples !== undefined) {
        for (const [k, v] of Object.entries(obj.examples as Record<string, Spec>)) push(`examples/${k}`, v.value);
      }
      if (obj.example !== undefined) push("example", obj.example);
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k === "examples" || k === "example") continue;
      visit(v, `${path}/${k}`);
    }
  };
  visit(spec, "");
  return out;
}
