// NL-86: `npx tsx evals/src/driver/main.ts --unit G6-U4 --outline <csv> [--provider stub|real] [--cap-usd n] [--prompt-version id] [--base-url url]`
// Exit 0 done, 2 refused or failed. Credentials come only from DRIVER_EMAIL / DRIVER_PASSWORD.
import { pathToFileURL } from "node:url";
import { resolve_cap } from "./cap.ts";
import { FullRunDriver } from "./driver.ts";
import { DriverError, type DriverConfig, type DriverResult } from "./types.ts";

function flags(argv: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i] as string;
    if (!f.startsWith("--")) throw new DriverError("USAGE", `unexpected argument ${f}`);
    const v = argv[++i];
    if (v === undefined) throw new DriverError("USAGE", `${f} needs a value`);
    m.set(f, v);
  }
  return m;
}

/** Called once a run exists (finished, paused or failed after it started): builds the report from stored rows. Lives outside this folder (the driver itself reads no database). */
export type AfterRun = (info: { run_id: string; result: DriverResult | null }) => Promise<void>;

const DONE = new Set(["complete", "partial", "capped", "cancelled"]);

export async function main(argv: string[], env: Record<string, string | undefined>, deps: Partial<DriverConfig> = {}, after?: AfterRun): Promise<number> {
  try {
    const f = flags(argv);
    const unit = f.get("--unit");
    const outline = f.get("--outline") ?? env["DRIVER_OUTLINE_PATH"];
    if (unit === undefined || outline === undefined || outline === "") throw new DriverError("USAGE", "--unit and --outline (or DRIVER_OUTLINE_PATH) are required");
    const mode = f.get("--provider") ?? env["MODEL_PROVIDER_MODE"] ?? "stub";
    if (mode !== "stub" && mode !== "real") throw new DriverError("USAGE", "--provider is stub or real");
    const cap_usd = resolve_cap({ provider_mode: mode, cap_arg: f.get("--cap-usd") ?? null, env });
    const cfg: DriverConfig = {
      base_url: f.get("--base-url") ?? env["DRIVER_BASE_URL"] ?? "http://127.0.0.1:3000/api",
      email: env["DRIVER_EMAIL"] ?? "",
      password: env["DRIVER_PASSWORD"] ?? "",
      unit, outline_path: outline, provider_mode: mode, cap_usd,
      prompt_version_id: f.get("--prompt-version") ?? null,
      ...(env["DRIVER_ORIGIN"] !== undefined && env["DRIVER_ORIGIN"] !== "" ? { origin: env["DRIVER_ORIGIN"] } : {}),
      poll_ms: 2000, max_wall_ms: 7_200_000,
      fetch: globalThis.fetch, sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      log: (l) => process.stderr.write(`${l}\n`),
      ...deps,
    };
    const r = await new FullRunDriver(cfg).run();
    process.stdout.write(`run_id=${r.run_id} state=${r.final_state}\n`);
    if (after !== undefined) await after({ run_id: r.run_id, result: r });
    if (!DONE.has(r.final_state)) {
      process.stderr.write(`run stopped in state ${r.final_state}; it is not finished\n`);
      return 2;
    }
    return 0;
  } catch (e) {
    if (e instanceof DriverError) {
      process.stderr.write(`${e.message}\n`);
      if (e.run_id !== null && after !== undefined) await after({ run_id: e.run_id, result: null });
      return 2;
    }
    throw e;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2), process.env);
}
