// NL-100: seeds the con-11 lessons once per stack. Specs run in separate worker processes, so the manifest is cached in a file next to stack.json.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getStack } from "../support/real-stack";
import { db } from "../support/db";

const ROOT = resolve(__dirname, "../../../../..");
const CACHE = join(
  ROOT,
  "apps/web/test-results/integration-stack/con-11-seed.json",
);

export interface Seeded {
  lessons: Record<
    | "wp1"
    | "submitted"
    | "approved"
    | "reopened"
    | "schema99"
    | "badnode"
    | "markup"
    | "missing",
    string
  >;
  versions: Record<string, { id: string; number: number; kind: string }[]>;
  users: Record<string, string>;
  run_id: string;
  outline_version_id: string;
  prompt_version_id: string;
  row_hash: string;
  wp1_hash: string;
  isbn: string;
  standards: { code: string; text: string }[];
}

function child(args: string[], env: Record<string, string> = {}): string {
  const r = spawnSync(
    "npx",
    ["tsx", join(__dirname, "seed-lessons.ts"), ...args],
    {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 180_000,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ...env,
      } as unknown as NodeJS.ProcessEnv,
    },
  );
  if (r.status !== 0)
    throw new Error(
      `con-11 seed child failed (${r.status}): ${(r.stderr || r.stdout).slice(-2500)}`,
    );
  return r.stdout;
}

/** Idempotent per stack: reference data (stack.seed()) first, then the lessons. Returns the same manifest on every call. */
export async function seed(): Promise<Seeded> {
  const stack = getStack();
  if (existsSync(CACHE)) {
    const c = JSON.parse(readFileSync(CACHE, "utf8")) as {
      url: string;
      seeded: Seeded;
    };
    if (c.url === stack.databaseUrl) return c.seeded;
  }
  if (
    (await db().count("app_user", "email = $1", [
      "reviewer.demo@example.test",
    ])) === 0
  )
    await stack.seed();
  const seeded = JSON.parse(child(["seed", stack.databaseUrl])) as Seeded;
  writeFileSync(CACHE, JSON.stringify({ url: stack.databaseUrl, seeded }));
  return seeded;
}

/** Writes one more submit snapshot (edited title) for a lesson and returns its version id and hash. */
export function writeSnapshot(lessonId: string): {
  version_id: string;
  content_hash: string;
} {
  return JSON.parse(child(["snapshot", getStack().databaseUrl, lessonId])) as {
    version_id: string;
    content_hash: string;
  };
}
