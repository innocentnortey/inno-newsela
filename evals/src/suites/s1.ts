// NL-49 shell; filled by NL-84. Keep the exported signature.
import type { EvalSuite, ProviderMode } from "../types.ts";
import { make_shell } from "./shell.ts";

export function make_s1(_provider_mode: ProviderMode): EvalSuite {
  return make_shell("S1", "NL-84");
}
