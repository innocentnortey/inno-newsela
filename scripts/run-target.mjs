// Root script runner: an unbuilt target fails loudly (exit 2), never silently succeeds.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const [first, ...rest] = process.argv.slice(2);

function not_built(owner) {
  process.stderr.write(`NOT BUILT: owned by ${owner}\n`);
  process.exit(2);
}

if (first === "--probe") {
  const [target, owner] = rest;
  if (!fs.existsSync(path.resolve(repoRoot, target ?? ""))) not_built(owner ?? "unknown");
  process.exit(0);
}

const map = JSON.parse(fs.readFileSync(path.join(here, "script-targets.json"), "utf8"));
const entry = first === undefined ? undefined : map[first];
if (entry === undefined) {
  process.stderr.write(`NOT BUILT: unknown script ${first}\n`);
  process.exit(2);
}
if (!fs.existsSync(path.resolve(repoRoot, entry.target))) not_built(entry.owner);

const result = spawnSync(entry.run[0], [...entry.run.slice(1), ...rest], { stdio: "inherit", cwd: repoRoot });
process.exit(result.status ?? 1);
