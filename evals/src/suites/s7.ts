// NL-49 shell; filled by NL-84. Keep the exported signature.
import type { EvalSuite, ProviderMode } from "../types.ts";
import { make_shell } from "./shell.ts";

export function make_s7(_provider_mode: ProviderMode): EvalSuite {
  return make_shell("S7", "NL-84");
}
