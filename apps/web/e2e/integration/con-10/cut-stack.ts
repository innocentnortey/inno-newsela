// NL-104: a second `next start` on the already-built app with CUT_FLAGS=6, against the same test database.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { getStack } from "../support/real-stack";

const WEB_DIR = resolve(__dirname, "../../..");

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
  while (Date.now() < end) {
    try { if ((await fetch(url, { redirect: "manual" })).status === 200) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`cut stack did not become ready at ${url}`);
}

export async function startCutStack(): Promise<{ baseURL: string; stop(): Promise<void> }> {
  const port = String(await freePort());
  const baseURL = `http://localhost:${port}`;
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME,
    DATABASE_URL: getStack().databaseUrl, AUDIT_HASH_SALT: "e2e-salt-0000000000000000",
    COLLAB_INTERNAL_TOKEN: "e2e-token-00000000000000000", APP_ORIGIN: baseURL, MODEL_PROVIDER_MODE: "stub",
    SESSION_COOKIE_NAME: "ls_session", BUILD_ID: "e2e", LOG_LEVEL: "info", PORT: port, CUT_FLAGS: "6",
  } as unknown as NodeJS.ProcessEnv;
  const child: ChildProcess = spawn("npx", ["next", "start", "-p", port, "-H", "localhost"], { cwd: WEB_DIR, env, detached: true, stdio: "ignore" });
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise<void>((done) => {
      const group = (sig: NodeJS.Signals) => { try { process.kill(-(child.pid as number), sig); } catch { child.kill(sig); } };
      const hard = setTimeout(() => group("SIGKILL"), 5000);
      child.once("exit", () => { clearTimeout(hard); done(); });
      group("SIGTERM");
    });
  };
  try {
    await waitFor200(`${baseURL}/sign-in`, 60_000);
  } catch (e) {
    await stop();
    throw e;
  }
  return { baseURL, stop };
}
