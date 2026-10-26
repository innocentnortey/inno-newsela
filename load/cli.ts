// NL-118: argument parsing for `npm run load:spike` (pure; the password is never a flag).
import os from "node:os";
import path from "node:path";

export class ProbeRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProbeRefusal";
  }
}

export interface CliConfig {
  users: number;
  ramp_s: number;
  plateau_s: number;
  ramp_down_s: number;
  base_url: string;
  database_url: string;
  password_env: string;
  unit: string | null;
  out_dir: string;
  request_log: string | null;
  provider_mode: "stub" | "real";
  allow_remote: boolean;
  socket_editors: number;
}

const LOCAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const INT_FLAGS = ["--users", "--ramp-s", "--plateau-s", "--ramp-down-s", "--socket-editors"];
const STR_FLAGS = ["--base-url", "--database-url", "--password-env", "--unit", "--out-dir", "--request-log", "--provider"];

export function parse_args(argv: string[], env: Record<string, string | undefined>): CliConfig {
  const vals = new Map<string, string>();
  let allow_remote = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--allow-remote") {
      allow_remote = true;
    } else if (a === "--password" || a.startsWith("--password=")) {
      throw new ProbeRefusal("the password is never a flag; put it in the environment variable named by --password-env");
    } else if (INT_FLAGS.includes(a) || STR_FLAGS.includes(a)) {
      const v = argv[++i];
      if (v === undefined) throw new ProbeRefusal(`${a} needs a value`);
      vals.set(a, v);
    } else {
      throw new ProbeRefusal(`unknown argument ${a}`);
    }
  }
  const int = (flag: string, dflt: number, min: number): number => {
    const raw = vals.get(flag);
    if (raw === undefined) return dflt;
    if (!/^\d+$/.test(raw) || Number(raw) < min) throw new ProbeRefusal(`${flag} must be an integer >= ${min}`);
    return Number(raw);
  };
  const provider = vals.get("--provider") ?? "stub";
  if (provider !== "stub" && provider !== "real") throw new ProbeRefusal("--provider must be stub or real");
  if (provider !== "stub") throw new ProbeRefusal("refusing: the probe runs against the stub provider only (no model spend)");
  const base_url = vals.get("--base-url") ?? env["LOAD_BASE_URL"] ?? "http://127.0.0.1:3000";
  let host: string;
  try {
    host = new URL(base_url).hostname;
  } catch {
    throw new ProbeRefusal("--base-url is not a URL");
  }
  if (!allow_remote && !LOCAL.has(host)) {
    throw new ProbeRefusal(`refusing: ${host} is not a local host (pass --allow-remote only for a stack you may load)`);
  }
  const database_url = vals.get("--database-url") ?? env["DATABASE_URL"] ?? "";
  return {
    users: int("--users", 200, 1),
    ramp_s: int("--ramp-s", 120, 0),
    plateau_s: int("--plateau-s", 900, 1),
    ramp_down_s: int("--ramp-down-s", 120, 0),
    socket_editors: int("--socket-editors", 0, 0),
    base_url,
    database_url,
    password_env: vals.get("--password-env") ?? "LOAD_PROBE_PASSWORD",
    unit: vals.get("--unit") ?? null,
    out_dir: vals.get("--out-dir") ?? "evals/reports",
    request_log: vals.get("--request-log") ?? null,
    provider_mode: "stub",
    allow_remote,
  };
}

export function default_request_log(probe_run_id: string): string {
  return path.join(os.tmpdir(), "ls-load", `${probe_run_id}.requests.jsonl`);
}
