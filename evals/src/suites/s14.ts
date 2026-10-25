// NL-49 shell; filled by NL-118/NL-119. Keep the exported signature.
import type { EvalSuite, ProviderMode } from "../types.ts";
import { make_shell } from "./shell.ts";

export function make_s14(_provider_mode: ProviderMode): EvalSuite {
  return make_shell("S14", "NL-118/NL-119");
}
