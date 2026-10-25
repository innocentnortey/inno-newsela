// NL-49 (DO-4 §9)
import type { JsonValue } from "@ls/core/ports/common";
import type { ProbeRunRecord } from "@ls/core/ports/evidence";

export interface SpikeOptions {
  users: number;
  ramp_s: number;
  plateau_s: number;
  socket_editors: number;
  base_url: string;
  collab_url: string;
}
export interface MixResult {
  p95_ms: JsonValue;
  error_rate: number;
  lost_updates: number;
  n: number;
}
export type { ProbeRunRecord };
