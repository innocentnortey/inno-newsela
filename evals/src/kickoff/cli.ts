// NL-108 (WF-46): `npx tsx evals/src/kickoff/cli.ts --out <path>`. Exit 0 written, 2 usage/collect error/leak guard.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { make_leak_guard } from "../leak-guard.ts";
import { collect_kickoff, type KickoffData } from "./collect.ts";
import { render_kickoff } from "./render.ts";

export interface KickoffDeps {
  root?: string;
  collect?: (root: string, opts: { env: Record<string, string | undefined>; now?: () => Date }) => KickoffData;
  now?: () => Date;
}

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export async function main(argv: string[], env: Record<string, string | undefined>, deps: KickoffDeps = {}): Promise<number> {
  const at = argv.indexOf("--out");
  const out = at >= 0 ? argv[at + 1] : undefined;
  if (out === undefined || out === "" || out.startsWith("--")) {
    process.stderr.write("usage: cli.ts --out <path>\n");
    return 2;
  }
  try {
    const root = deps.root ?? DEFAULT_ROOT;
    const collect = deps.collect ?? ((r, o) => collect_kickoff(r, o));
    const page = render_kickoff(collect(root, { env, ...(deps.now ? { now: deps.now } : {}) }));
    make_leak_guard(env)("kickoff page", page);
    const abs = path.resolve(out);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, page);
    process.stdout.write(`wrote ${abs}\nopen "${abs}"\n`);
    return 0;
  } catch (e) {
    process.stderr.write(`kickoff failed: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2), process.env).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`${String(e)}\n`);
      process.exit(2);
    },
  );
}
