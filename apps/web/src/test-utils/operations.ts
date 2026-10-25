import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { components, operations } from "../lib/api-types";

export type OperationId = keyof operations;
export type ErrorCode = components["schemas"]["ErrorCode"];

interface Spec {
  paths: Record<string, Record<string, { operationId?: string }>>;
  "x-error-catalog": { codes: Record<string, { status: number }> };
}

const spec = parse(
  readFileSync(path.resolve(__dirname, "../../../../docs/contracts/interface.openapi.yaml"), "utf8"),
) as Spec;

const METHODS = ["get", "put", "post", "delete", "patch"];

export function operationRoute(id: OperationId): { method: string; path: string } {
  for (const [p, item] of Object.entries(spec.paths)) {
    for (const m of METHODS) {
      if (item[m]?.operationId === id) return { method: m, path: p };
    }
  }
  throw new Error(`Unknown operation ${id}`);
}

export function errorStatus(code: ErrorCode): number {
  const entry = spec["x-error-catalog"].codes[code];
  if (!entry) throw new Error(`Unknown error code ${code}`);
  return entry.status;
}
