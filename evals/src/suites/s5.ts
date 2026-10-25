// NL-49 shell; filled by NL-125. Keep the exported signature.
import type { EvalSuite, ProviderMode } from "../types.ts";
import { make_shell } from "./shell.ts";

export function make_s5(_provider_mode: ProviderMode): EvalSuite {
  return make_shell("S5", "NL-125");
}
