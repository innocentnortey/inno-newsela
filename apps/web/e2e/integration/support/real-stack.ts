// NL-90 support: start the real stack (built Next app + fresh migrated test DB) for the integration specs.
// global-setup starts it once; specs run in worker processes, so getStack() reads test-results/integration-stack/stack.json.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";

export interface Stack {
  baseURL: string;
  databaseUrl: string;
  logs(): string[];
  seed(): Promise<{ password: string; emails: Record<"author" | "reviewer" | "approver", string> }>;
  stop(): Promise<void>;
}

const WEB_DIR = resolve(__dirname, "../../..");
const ROOT = resolve(WEB_DIR, "../..");
// Outside Playwright's outputDir on purpose: the AC-5 spec scans every outputDir file for the canary.
const STATE_DIR = join(WEB_DIR, "test-results", "integration-stack");
const STATE_FILE = join(STATE_DIR, "stack.json");
const LOG_FILE = join(STATE_DIR, "web.log");
const LOG_CAP = 5000;
const SALT = "e2e-salt-0000000000000000";

export function seedEmails() {
  return {
    author: "author.demo@example.test",
    reviewer: "reviewer.demo@example.test",
    approver: "approver.demo@example.test",
  } as const;
}

function readLogs(): string[] {
  if (!existsSync(LOG_FILE)) return [];
  return readFileSync(LOG_FILE, "utf8").split("\n").filter(Boolean).slice(-LOG_CAP);
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
  throw new Error(`stack did not become ready at ${url} within ${ms} ms (${last})`);
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
        process.kill(-(child.pid as number), sig); // detached: npx, next and next-server share one process group
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

// The e2e worker always runs the stub model and never holds a provider key, even if the caller's shell does.
export function workerEnv(base: NodeJS.ProcessEnv, port: string): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {
    ...base,
    MODEL_PROVIDER_MODE: "stub",
    WORKER_HEALTH_PORT: port,
    JOB_POLL_MS: "200",
    CHECK_POLL_MS: "200",
    WORKER_ID: "e2e-worker",
  };
  delete out.ANTHROPIC_API_KEY;
  delete out.OPENROUTER_API_KEY;
  return out;
}

export async function startStack(opts: { web?: boolean; worker?: boolean; collab?: boolean }): Promise<Stack> {
  const port = process.env.E2E_PORT ?? "3121";
  const baseURL = `http://localhost:${port}`;
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(LOG_FILE, "");

  const made = spawnSync("npx", ["tsx", join(__dirname, "db-admin.ts"), "create"], { cwd: ROOT, encoding: "utf8", timeout: 120_000 });
  if (made.status !== 0) throw new Error(`test database create failed: ${(made.stderr || made.stdout).slice(-1500)}`);
  const testDb = JSON.parse(made.stdout) as { url: string; name: string };
  const children: ChildProcess[] = [];
  const ring: string[] = [];
  const sink = (line: string) => {
    ring.push(line);
    if (ring.length > LOG_CAP) ring.shift();
    appendFileSync(LOG_FILE, `${line}\n`);
  };

  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DATABASE_URL: testDb.url,
    AUDIT_HASH_SALT: SALT,
    COLLAB_INTERNAL_TOKEN: "e2e-token-00000000000000000",
    APP_ORIGIN: baseURL,
    MODEL_PROVIDER_MODE: "stub",
    SESSION_COOKIE_NAME: "ls_session",
    BUILD_ID: "e2e",
    LOG_LEVEL: "info",
    PORT: port,
  } as unknown as NodeJS.ProcessEnv;
  // NL-116: optional pass-through, set only when the E2E_* variable is present, so no other spec sees a changed value.
  for (const [name, from] of [
    ["COLLAB_INTERNAL_URL", "E2E_COLLAB_INTERNAL_URL"],
    ["ASSIST_CALL_TIMEOUT_MS", "E2E_ASSIST_TIMEOUT_MS"],
    ["ASSIST_STUB_FILE", "E2E_ASSIST_STUB_FILE"],
    ["SUGGESTION_TTL_MIN", "E2E_SUGGESTION_TTL_MIN"],
    ["SHEETS_BASE_URL", "E2E_SHEETS_BASE_URL"],
  ] as const) {
    const v = process.env[from];
    if (v !== undefined && v !== "") env[name] = v;
  }

  const stop = async () => {
    for (const c of children.reverse()) await kill(c);
    spawnSync("npx", ["tsx", join(__dirname, "db-admin.ts"), "drop", testDb.name], { cwd: ROOT, timeout: 60_000 });
  };

  try {
    if (opts.web !== false) {
      if (process.env.E2E_SKIP_BUILD !== "1" || !existsSync(join(WEB_DIR, ".next", "BUILD_ID"))) {
        const b = spawnSync("npx", ["next", "build"], { cwd: WEB_DIR, env, encoding: "utf8", timeout: 8 * 60_000 });
        if (b.status !== 0) throw new Error(`next build failed (status ${b.status}): ${(b.stdout + b.stderr).slice(-2000)}`);
      }
      const web = spawn("npx", ["next", "start", "-p", port, "-H", "localhost"], { cwd: WEB_DIR, env, detached: true });
      children.push(web);
      pipeLines(web, sink);
      await waitFor200(`${baseURL}/sign-in`, 90_000);
    }
    if (opts.worker) {
      const workerPort = String(await freePort());
      const worker = spawn("npx", ["tsx", "apps/worker/src/main.ts"], { cwd: ROOT, env: workerEnv(env, workerPort), detached: true });
      children.push(worker);
      pipeLines(worker, (l) => sink(`[worker] ${l}`));
      await waitFor200(`http://127.0.0.1:${workerPort}/healthz`, 60_000);
    }
    if (opts.collab) {
      const collabPort = String(await freePort());
      const collab = spawn("npx", ["tsx", "apps/collab/src/main.ts"], {
        cwd: ROOT,
        env: { ...env, PORT: collabPort, COLLAB_PORT: collabPort },
        detached: true,
      });
      children.push(collab);
      pipeLines(collab, (l) => sink(`[collab] ${l}`));
    }
  } catch (e) {
    await stop();
    throw e;
  }

  writeFileSync(STATE_FILE, JSON.stringify({ baseURL, databaseUrl: testDb.url }));
  return makeStack(baseURL, testDb.url, () => ring.slice(), stop);
}

function makeStack(baseURL: string, databaseUrl: string, logs: () => string[], stop: () => Promise<void>): Stack {
  return {
    baseURL,
    databaseUrl,
    logs,
    stop,
    async seed() {
      const password = randomBytes(15).toString("base64url").replace(/[^A-Za-z0-9]/g, "a").slice(0, 20).padEnd(20, "x");
      const env = { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: databaseUrl, SEED_DEMO_PASSWORD: password } as unknown as NodeJS.ProcessEnv;
      const r = spawnSync("npx", ["tsx", "ops/seed.ts"], { cwd: ROOT, env, encoding: "utf8", timeout: 120_000 });
      if (r.status !== 0) throw new Error(`seed failed (status ${r.status}): ${(r.stderr || r.stdout).replaceAll(password, "***").slice(-1500)}`);
      return { password, emails: { ...seedEmails() } };
    },
  };
}

export function getStack(): Stack {
  if (!existsSync(STATE_FILE)) throw new Error("real stack not started: global-setup did not write stack.json");
  const { baseURL, databaseUrl } = JSON.parse(readFileSync(STATE_FILE, "utf8")) as { baseURL: string; databaseUrl: string };
  return makeStack(baseURL, databaseUrl, readLogs, async () => undefined);
}
