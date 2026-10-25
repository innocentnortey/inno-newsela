// NL-115 support: a private collab process and a second web server that can reach it (plan 4.1).
// The shared stack's web has no COLLAB_INTERNAL_URL (its default http://collab:1234/internal does not resolve), so submit,
// withdraw, request_changes and reopen answer COLLAB_UNAVAILABLE there. support/** is read-only, so this spec folder starts
// (a) `apps/collab/src/main.ts` against the shared stack's database and (b) a second `next start` on the existing build,
// pointed at that collab. Both are killed (process group) by stop(); nothing else is touched.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { getStack } from "../support/real-stack";

const WEB_DIR = resolve(__dirname, "../../..");
const ROOT = resolve(WEB_DIR, "../..");
export const COLLAB_TOKEN = "e2e-token-00000000000000000";
const SALT = "e2e-salt-0000000000000000";
const LOG_CAP = 8000;

export interface Con18Stack {
  /** The second web server's origin: every spec in this folder uses it as the browser/API base URL. */
  baseURL: string;
  collabPort: number;
  /** Application log lines of web2 and collab since start (prefixed `[web2]` / `[collab]`). */
  logs(): string[];
  stop(): Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.once("error", fail);
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => ok(port));
    });
  });
}

async function waitFor200(url: string, ms: number): Promise<void> {
  const end = Date.now() + ms;
  let last = "";
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      if (r.status === 200) return;
      last = `status ${r.status}`;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} not ready within ${ms} ms (${last})`);
}

function pipeLines(child: ChildProcess, sink: (line: string) => void): void {
  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) continue;
    let rest = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      const parts = (rest + chunk).split("\n");
      rest = parts.pop() ?? "";
      for (const p of parts) if (p) sink(p);
    });
  }
}

async function kill(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((done) => {
    const group = (sig: NodeJS.Signals) => {
      try {
        process.kill(-(child.pid as number), sig); // detached: npx and its server share one process group
      } catch {
        child.kill(sig);
      }
    };
    const hard = setTimeout(() => group("SIGKILL"), 5000);
    child.once("exit", () => {
      clearTimeout(hard);
      done();
    });
    group("SIGTERM");
  });
}

export async function startCon18Stack(): Promise<Con18Stack> {
  const shared = getStack();
  const webPort = Number(process.env["CON18_PORT"] ?? Number(process.env["E2E_PORT"] ?? "3121") + 1);
  const baseURL = `http://localhost:${webPort}`;
  const collabPort = await freePort();
  const ring: string[] = [];
  const sink = (prefix: string) => (line: string) => {
    ring.push(`${prefix} ${line}`);
    if (ring.length > LOG_CAP) ring.shift();
  };
  const children: ChildProcess[] = [];
  const stop = async () => {
    for (const c of children.splice(0).reverse()) await kill(c);
  };
  process.once("exit", () => {
    for (const c of children) {
      try {
        process.kill(-(c.pid as number), "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  });

  const base = {
    PATH: process.env["PATH"],
    HOME: process.env["HOME"],
    DATABASE_URL: shared.databaseUrl,
    AUDIT_HASH_SALT: SALT,
    COLLAB_INTERNAL_TOKEN: COLLAB_TOKEN,
    MODEL_PROVIDER_MODE: "stub",
    SESSION_COOKIE_NAME: "ls_session",
    BUILD_ID: "e2e",
    LOG_LEVEL: "info",
  };
  try {
    const collab = spawn("npx", ["tsx", "apps/collab/src/main.ts"], {
      cwd: ROOT,
      env: { ...base, PORT: String(collabPort), COLLAB_PORT: String(collabPort), STORE_DEBOUNCE_MS: "500", STORE_MAX_DEBOUNCE_MS: "1000" } as unknown as NodeJS.ProcessEnv,
      detached: true,
    });
    children.push(collab);
    pipeLines(collab, sink("[collab]"));
    await waitFor200(`http://127.0.0.1:${collabPort}/healthz`, 60_000);

    if (!existsSync(join(WEB_DIR, ".next", "BUILD_ID"))) throw new Error("no .next build: run the real-stack project once (global-setup builds it) or `next build`");
    const web = spawn("npx", ["next", "start", "-p", String(webPort), "-H", "localhost"], {
      cwd: WEB_DIR,
      env: {
        ...base,
        APP_ORIGIN: baseURL,
        PORT: String(webPort),
        COLLAB_INTERNAL_URL: `http://127.0.0.1:${collabPort}/internal`,
      } as unknown as NodeJS.ProcessEnv,
      detached: true,
    });
    children.push(web);
    pipeLines(web, sink("[web2]"));
    await waitFor200(`${baseURL}/sign-in`, 90_000);
  } catch (e) {
    await stop();
    throw e;
  }
  return { baseURL, collabPort, logs: () => ring.slice(), stop };
}
