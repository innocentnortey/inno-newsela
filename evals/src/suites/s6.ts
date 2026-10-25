// NL-49 shell; filled by NL-107. Keep the exported signature.
import type { EvalSuite, ProviderMode } from "../types.ts";
import { make_shell } from "./shell.ts";

export function make_s6(_provider_mode: ProviderMode): EvalSuite {
  return make_shell("S6", "NL-107");
}
