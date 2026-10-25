// NL-49 shell; filled by NL-86. Keep the exported signature.
import type { EvalSuite, ProviderMode } from "../types.ts";
import { make_shell } from "./shell.ts";

export function make_s13(_provider_mode: ProviderMode): EvalSuite {
  return make_shell("S13", "NL-86");
}
