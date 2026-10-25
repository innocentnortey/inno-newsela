// NL-49 shell; filled by NL-118.
import { pathToFileURL } from "node:url";
import { NotImplemented } from "./errors.ts";
import type { ProbeRunRecord, SpikeOptions } from "./types.ts";

export async function run_spike(_opts: SpikeOptions): Promise<ProbeRunRecord> {
  throw new NotImplemented("run_spike", "NL-118");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await run_spike({ users: 200, ramp_s: 120, plateau_s: 900, socket_editors: 0, base_url: "", collab_url: "" });
  } catch (e) {
    if (!(e instanceof NotImplemented)) throw e;
    process.stderr.write(`${e.message}\n`);
    process.exitCode = 2;
  }
}
