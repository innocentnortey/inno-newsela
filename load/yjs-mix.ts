// NL-49 shell; filled by NL-119.
import { NotImplemented } from "./errors.ts";
import type { MixResult, SpikeOptions } from "./types.ts";

export async function run_yjs_mix(_opts: SpikeOptions): Promise<MixResult> {
  throw new NotImplemented("run_yjs_mix", "NL-119");
}
