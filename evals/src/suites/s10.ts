// NL-49 shell; filled by NL-92. Keep the exported signature.
import type { EvalSuite, ProviderMode } from "../types.ts";
import { make_shell } from "./shell.ts";

export function make_s10(_provider_mode: ProviderMode): EvalSuite {
  return make_shell("S10", "NL-92");
}
