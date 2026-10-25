// NL-49 shell; filled by NL-118.
import { NotImplemented } from "./errors.ts";
import type { MixResult, SpikeOptions } from "./types.ts";

export async function run_http_mix(_opts: SpikeOptions): Promise<MixResult> {
  throw new NotImplemented("run_http_mix", "NL-118");
}
