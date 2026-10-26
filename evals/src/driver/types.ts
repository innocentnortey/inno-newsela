// NL-86: the full-run driver's types. Depends on nothing but the generated API types (type-only).
import type { components } from "../../../docs/contracts/generated/api-types.ts";

export type Schemas = components["schemas"];
export type RunSummaryT = Schemas["RunSummary"];
export type RunProgressT = Schemas["RunProgress"];

export interface DriverConfig {
  base_url: string;
  email: string;
  password: string;
  unit: string;
  outline_path: string;
  provider_mode: "real" | "stub";
  cap_usd: number;
  prompt_version_id: string | null;
  poll_ms: number;
  max_wall_ms: number;
  /** Origin header sent on every call (the web app checks it against APP_ORIGIN); defaults to the origin of base_url. */
  origin?: string;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
}

export interface DriverResult {
  run_id: string;
  final_state: string;
  summary: RunSummaryT;
  polls: number;
}

export type DriverErrorCode = "HTTP_STATUS" | "SHAPE" | "TIMEOUT" | "CAP_REFUSED" | "NO_CREDENTIALS" | "USAGE";

export class DriverError extends Error {
  readonly code: DriverErrorCode;
  /** Set once a run exists, so a caller can still report from the stored rows. */
  run_id: string | null = null;
  constructor(code: DriverErrorCode, message: string, run_id: string | null = null) {
    super(`${code}: ${message}`);
    this.name = "DriverError";
    this.code = code;
    this.run_id = run_id;
  }
}
