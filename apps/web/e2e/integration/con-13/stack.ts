// NL-113 harness: a second web, the real collaboration server and the real check worker on the SAME database as the
// global-setup stack. global-setup starts only `next start` with no COLLAB_INTERNAL_URL and no worker, and support/ is
// read-only here, so this file copies its spawn pattern. No Docker, no provider key (OBS-7): the worker runs the stub.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { getStack, workerEnv } from "../support/real-stack";

export interface Live {
  baseURL: string;
  collabPort: number;
  /** Application log lines of the web2, collab and worker children (prefixed). */
  logs(): string[];
  stop(): Promise<void>;
}

const WEB_DIR = resolve(__dirname, "../../..");
const ROOT = resolve(WEB_DIR, "../..");
const TOKEN = "e2e-token-00000000000000000";
const SALT = "e2e-salt-0000000000000000";
const LOG_CAP = 5000;

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
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`not ready: ${url} within ${ms} ms (${last})`);
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

async function kill(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((done) => {
    const group = (sig: NodeJS.Signals) => {
      try {
        process.kill(-(child.pid as number), sig);
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

interface Parts {
  web?: ChildProcess;
  collab?: ChildProcess;
  worker?: ChildProcess;
  ring: string[];
  webPort: number;
  collabPort: number;
  workerPort: number;
  env: NodeJS.ProcessEnv;
}

let parts: Parts | undefined;
let starting: Promise<Live> | undefined;

function baseEnv(webPort: number): NodeJS.ProcessEnv {
  const stack = getStack();
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DATABASE_URL: stack.databaseUrl,
    AUDIT_HASH_SALT: SALT,
    COLLAB_INTERNAL_TOKEN: TOKEN,
    APP_ORIGIN: `http://localhost:${webPort}`,
    MODEL_PROVIDER_MODE: "stub",
    SESSION_COOKIE_NAME: "ls_session",
    BUILD_ID: "e2e",
    LOG_LEVEL: "info",
    PORT: String(webPort),
  } as unknown as NodeJS.ProcessEnv;
}

async function startCollab(p: Parts): Promise<void> {
  const port = String(p.collabPort);
  p.collab = spawn("npx", ["tsx", "apps/collab/src/main.ts"], {
    cwd: ROOT,
    env: { ...p.env, PORT: port, COLLAB_PORT: port, STORE_DEBOUNCE_MS: "500", STORE_MAX_DEBOUNCE_MS: "1000" },
    detached: true,
  });
  pipeLines(p.collab, (l) => p.ring.push(`[collab] ${l}`));
  await waitFor200(`http://127.0.0.1:${port}/healthz`, 60_000);
}

async function startWorker(p: Parts): Promise<void> {
  p.worker = spawn("npx", ["tsx", "apps/worker/src/main.ts"], { cwd: ROOT, env: workerEnv(p.env, String(p.workerPort)), detached: true });
  pipeLines(p.worker, (l) => p.ring.push(`[worker] ${l}`));
  await waitFor200(`http://127.0.0.1:${p.workerPort}/healthz`, 60_000);
}

function live(p: Parts): Live {
  return {
    baseURL: `http://localhost:${p.webPort}`,
    collabPort: p.collabPort,
    logs: () => [...p.ring.slice(-LOG_CAP), ...getStack().logs()],
    stop: stopLive,
  };
}

/** Start (once per worker process) web2 + collab + worker on getStack().databaseUrl. `fresh` restarts what stopCollab/stopWorker killed. */
export async function liveStack(opts: { fresh?: boolean } = {}): Promise<Live> {
  if (starting) await starting;
  if (parts && opts.fresh) {
    if (parts.collab?.exitCode !== null || parts.collab?.signalCode) await startCollab(parts);
    if (parts.worker?.exitCode !== null || parts.worker?.signalCode) await startWorker(parts);
    return live(parts);
  }
  if (parts) return live(parts);
  starting = (async () => {
    if (!existsSync(join(WEB_DIR, ".next", "BUILD_ID"))) throw new Error("no .next build: global-setup builds it before specs run");
    const webPort = await freePort();
    const p: Parts = { ring: [], webPort, collabPort: await freePort(), workerPort: await freePort(), env: baseEnv(webPort) };
    parts = p;
    try {
      await startCollab(p);
      p.web = spawn("npx", ["next", "start", "-p", String(webPort), "-H", "localhost"], {
        cwd: WEB_DIR,
        env: { ...p.env, COLLAB_INTERNAL_URL: `http://127.0.0.1:${p.collabPort}/internal` },
        detached: true,
      });
      pipeLines(p.web, (l) => p.ring.push(`[web2] ${l}`));
      await waitFor200(`http://localhost:${webPort}/sign-in`, 90_000);
      await startWorker(p);
    } catch (e) {
      await stopLive();
      throw e;
    }
    return live(p);
  })();
  try {
    return await starting;
  } finally {
    starting = undefined;
  }
}

/** AC-10 collab_down: kill only this collab child. Restart with liveStack({ fresh: true }). */
export async function stopCollab(): Promise<void> {
  await kill(parts?.collab);
}
/** AC-2: hold the check lane so a check_job stays queued. Restart with liveStack({ fresh: true }). */
export async function stopWorker(): Promise<void> {
  await kill(parts?.worker);
}

export async function stopLive(): Promise<void> {
  const p = parts;
  parts = undefined;
  if (!p) return;
  await kill(p.worker);
  await kill(p.web);
  await kill(p.collab);
}
