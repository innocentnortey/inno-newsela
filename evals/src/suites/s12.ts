// NL-49 shell; filled by NL-111. Keep the exported signature.
import type { EvalSuite, ProviderMode } from "../types.ts";
import { make_shell } from "./shell.ts";

export function make_s12(_provider_mode: ProviderMode): EvalSuite {
  return make_shell("S12", "NL-111");
}
