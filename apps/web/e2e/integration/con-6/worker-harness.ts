// NL-96: spawn the scripted stand-in worker (worker-entry.ts) against the real stack's database. Never edits real-stack.ts.
import { spawn, type ChildProcess } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { getStack, workerEnv } from "../support/real-stack";

const ROOT = resolve(__dirname, "../../../../..");
export interface Call { ts: number; schema: string; lesson: string; n: number }
export interface WorkerHandle {
  pid: number;
  gateDir: string;
  lines(): string[];
  hold(lesson: string, n?: number): void;
  release(lesson: string, n?: number): void;
  fix(): void;
  calls(): Call[];
  stop(): Promise<void>;
  kill(): Promise<void>;
}

const exited = (c: ChildProcess) => c.exitCode !== null || c.signalCode !== null;
function end(c: ChildProcess, sig: NodeJS.Signals): Promise<void> {
  if (exited(c)) return Promise.resolve();
  return new Promise((done) => {
    const hard = setTimeout(() => { try { process.kill(-(c.pid as number), "SIGKILL"); } catch { c.kill("SIGKILL"); } }, 8000);
    c.once("exit", () => { clearTimeout(hard); done(); });
    try { process.kill(-(c.pid as number), sig); } catch { c.kill(sig); }
  });
}

const live: WorkerHandle[] = [];
const gateDirs: string[] = [];
/** Removes every hold file of every worker this process started (so nothing stays blocked at the end of a test). */
export function releaseAllHolds(): void {
  for (const d of gateDirs) for (const f of readdirSync(d)) if (f.startsWith("hold-")) rmSync(join(d, f), { force: true });
}
/** Call from test.afterEach: kills every stand-in worker a test started. */
export async function killAllWorkers(): Promise<void> {
  for (const w of live.splice(0)) await w.kill();
}

export async function startWorker(opts: { script?: string; env?: Record<string, string>; gateDir?: string; holds?: Array<[string, number?]> } = {}): Promise<WorkerHandle> {
  const gateDir = opts.gateDir ?? mkdtempSync(join(tmpdir(), "con6-gate-"));
  gateDirs.push(gateDir);
  if (!existsSync(join(gateDir, "calls.jsonl"))) writeFileSync(join(gateDir, "calls.jsonl"), "");
  for (const [l, n] of opts.holds ?? []) writeFileSync(join(gateDir, n ? `hold-${l}-${n}` : `hold-${l}`), "");
  const stack = getStack();
  const base = {
    PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: stack.databaseUrl, AUDIT_HASH_SALT: "e2e-salt-0000000000000000",
    COLLAB_INTERNAL_TOKEN: "e2e-token-00000000000000000", MODEL_PROVIDER_MODE: "stub",
    GENERATION_CONCURRENCY: "2", JOB_POLL_MS: "100",
    CON6_SCRIPT: opts.script ?? "script-a", CON6_GATE_DIR: gateDir, ...opts.env,
  } as unknown as NodeJS.ProcessEnv;
  const child = spawn("npx", ["tsx", "apps/web/e2e/integration/con-6/worker-entry.ts"], { cwd: ROOT, env: workerEnv(base, "0"), detached: true });
  const ring: string[] = [];
  for (const s of [child.stdout, child.stderr]) {
    let rest = "";
    s?.setEncoding("utf8");
    s?.on("data", (chunk: string) => {
      const parts = (rest + chunk).split("\n");
      rest = parts.pop() ?? "";
      for (const p of parts) if (p) { ring.push(p); if (ring.length > 3000) ring.shift(); appendFileSync(join(gateDir, "worker.log"), `${p}\n`); }
    });
  }
  const until = Date.now() + 60_000;
  while (!ring.some((l) => l.includes("con6.worker.started"))) {
    if (exited(child)) throw new Error(`stand-in worker exited early: ${ring.slice(-5).join(" | ")}`);
    if (Date.now() > until) { await end(child, "SIGKILL"); throw new Error("stand-in worker did not start"); }
    await new Promise((r) => setTimeout(r, 100));
  }
  const handle: WorkerHandle = {
    pid: child.pid as number,
    gateDir,
    lines: () => ring.slice(),
    hold: (l, n) => writeFileSync(join(gateDir, n ? `hold-${l}-${n}` : `hold-${l}`), ""),
    release: (l, n) => rmSync(join(gateDir, n ? `hold-${l}-${n}` : `hold-${l}`), { force: true }),
    fix: () => writeFileSync(join(gateDir, "fixed"), ""),
    calls: () => readFileSync(join(gateDir, "calls.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Call),
    stop: () => end(child, "SIGTERM"),
    kill: () => end(child, "SIGKILL"),
  };
  live.push(handle);
  return handle;
}
