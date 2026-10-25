// NL-49 shell; filled by NL-121. Keep the exported signature.
import type { EvalSuite, ProviderMode } from "../types.ts";
import { make_shell } from "./shell.ts";

export function make_s11(_provider_mode: ProviderMode): EvalSuite {
  return make_shell("S11", "NL-121");
}
