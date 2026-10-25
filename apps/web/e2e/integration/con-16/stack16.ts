// NL-114: the shared real stack has no collab process and no COLLAB_INTERNAL_URL (support/real-stack.ts is not ours to edit),
// so this suite starts its own collaboration server and a second `next start` that points at it, on the same migrated database.
// "Collaboration container stopped" (AC-6) is modelled by stopping this process: Compose is not started for e2e.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { getStack } from "../support/real-stack";

const WEB_DIR = resolve(__dirname, "../../..");
const ROOT = resolve(WEB_DIR, "../..");
export const COLLAB_TOKEN = "e2e-token-00000000000000000";
const SALT = "e2e-salt-0000000000000000";

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
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`not ready at ${url} within ${ms} ms (${last})`);
}

async function kill(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((done) => {
    const group = (sig: NodeJS.Signals) => {
      try {
        process.kill(-(child.pid as number), sig); // detached: npx and the server share one process group
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

export interface Stack16 {
  /** Origin of the second web (it talks to our collab); sign in and call APIs here. */
  webURL: string;
  collabPort: number;
  /** All log lines the collab child wrote since the suite started (survives restarts). */
  collabLog(): string[];
  webLog(): string[];
  stopCollab(): Promise<void>;
  /** Restarts collab on the SAME port and waits for /healthz. */
  startCollab(): Promise<void>;
  stop(): Promise<void>;
}

export async function startStack16(): Promise<Stack16> {
  const shared = getStack();
  const databaseUrl = shared.databaseUrl;
  const lines: string[] = [];
  const pipe = (c: ChildProcess, tag: string) => {
    for (const stream of [c.stdout, c.stderr]) {
      if (!stream) continue;
      let rest = "";
      stream.setEncoding("utf8");
      stream.on("data", (chunk: string) => {
        const parts = (rest + chunk).split("\n");
        rest = parts.pop() ?? "";
        for (const p of parts) if (p) lines.push(`[${tag}] ${p}`);
      });
    }
  };
  const collabPort = await freePort();
  const webPort = await freePort();
  let collab: ChildProcess | undefined;
  let web: ChildProcess | undefined;

  const startCollab = async () => {
    collab = spawn("npx", ["tsx", "apps/collab/src/main.ts"], {
      cwd: ROOT,
      detached: true,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        DATABASE_URL: databaseUrl,
        COLLAB_INTERNAL_TOKEN: COLLAB_TOKEN,
        COLLAB_PORT: String(collabPort),
        PORT: String(collabPort),
        SESSION_COOKIE_NAME: "ls_session",
        AUDIT_HASH_SALT: SALT,
        MODEL_PROVIDER_MODE: "stub",
        LOG_LEVEL: "info",
      } as unknown as NodeJS.ProcessEnv,
    });
    pipe(collab, "collab");
    await waitFor200(`http://127.0.0.1:${collabPort}/healthz`, 60_000);
  };
  const stopCollab = async () => {
    await kill(collab);
  };
  const stop = async () => {
    await kill(web);
    await kill(collab);
  };

  try {
    if (!existsSync(join(WEB_DIR, ".next", "BUILD_ID"))) throw new Error("no .next build: global-setup builds it");
    await startCollab();
    const webURL = `http://localhost:${webPort}`;
    web = spawn("npx", ["next", "start", "-p", String(webPort), "-H", "localhost"], {
      cwd: WEB_DIR,
      detached: true,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        DATABASE_URL: databaseUrl,
        AUDIT_HASH_SALT: SALT,
        COLLAB_INTERNAL_TOKEN: COLLAB_TOKEN,
        COLLAB_INTERNAL_URL: `http://127.0.0.1:${collabPort}/internal`,
        APP_ORIGIN: webURL,
        MODEL_PROVIDER_MODE: "stub",
        SESSION_COOKIE_NAME: "ls_session",
        BUILD_ID: "e2e",
        LOG_LEVEL: "info",
        PORT: String(webPort),
      } as unknown as NodeJS.ProcessEnv,
    });
    pipe(web, "web16");
    await waitFor200(`${webURL}/sign-in`, 90_000);
    return { webURL, collabPort, collabLog: () => lines.filter((l) => l.startsWith("[collab]")), webLog: () => lines.filter((l) => l.startsWith("[web16]")), stopCollab, startCollab, stop };
  } catch (e) {
    await stop();
    throw e;
  }
}
