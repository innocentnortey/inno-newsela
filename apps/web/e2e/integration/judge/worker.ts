// NL-110: global-setup starts only the web app, so the judge specs start their own stub-mode worker against the stack's database
// (real apps/worker/src/main.ts, started through loops.ts) and stop only that process group afterwards.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { getStack, workerEnv } from "../support/real-stack";

const ROOT = resolve(__dirname, "../../../../..");

async function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => res(port));
    });
  });
}

export async function startJudgeWorker(): Promise<() => Promise<void>> {
  const stack = getStack();
  const port = String(await freePort());
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DATABASE_URL: stack.databaseUrl,
    AUDIT_HASH_SALT: "e2e-salt-0000000000000000",
    COLLAB_INTERNAL_TOKEN: "e2e-token-00000000000000000",
    BUILD_ID: "e2e",
    LOG_LEVEL: "info",
  } as unknown as NodeJS.ProcessEnv;
  const child: ChildProcess = spawn("npx", ["tsx", "apps/worker/src/main.ts"], { cwd: ROOT, env: workerEnv(env, port), detached: true, stdio: "ignore" });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return async () => {
    if (child.exitCode !== null || child.pid === undefined) return;
    await new Promise<void>((done) => {
      const hard = setTimeout(() => {
        try { process.kill(-(child.pid as number), "SIGKILL"); } catch { /* gone */ }
      }, 5000);
      child.once("exit", () => (clearTimeout(hard), done()));
      try { process.kill(-(child.pid as number), "SIGTERM"); } catch { done(); }
    });
  };
}
