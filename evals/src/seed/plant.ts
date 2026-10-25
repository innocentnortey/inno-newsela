// NL-92: `eval:seed --plan <key>`. Plants copies into the seeded unit as the synthetic planter and starts the eval_run.
// Refusals happen before any write. Output never carries key contents.
import { promises as fs } from "node:fs";
import path from "node:path";
import { InvariantViolation } from "@ls/core/errors";
import { apply_plant, type Plant } from "./mutations.ts";
import type { LoadedKey } from "./key.ts";
import { DEFAULT_PLANTER_EMAIL, SEEDED_UNIT_ID, SeedSql, unit_of, type SeedDeps } from "./deps.ts";

export interface SeedState {
  eval_run_id: string;
  key_id: string;
  planter_id: string;
  plants: (Plant & { content_hash: string })[];
}

export const state_path = (repo_root: string, run_id: string): string => path.join(repo_root, "evals", "local", `seed-state-${run_id}.json`);

export async function plant_all(deps: SeedDeps, key: LoadedKey): Promise<{ eval_run_id: string; n: number }> {
  const sql = new SeedSql(deps);
  const email = deps.planter_email ?? DEFAULT_PLANTER_EMAIL;

  // 1. Refusals (nothing written yet).
  for (const p of key.plants) {
    if (unit_of(p.lesson_id) !== SEEDED_UNIT_ID) throw new InvariantViolation("refused: plant target is not in the seeded unit");
  }
  if (await sql.planter_is_reviewer(email)) throw new InvariantViolation("refused: planter account is a reviewer account");
  if ((await sql.standards_count()) === 0) throw new InvariantViolation("refused: standards are not seeded (npm run db:seed)");
  const sources = new Map<string, Awaited<ReturnType<SeedSql["latest_derived"]>>>();
  for (const p of key.plants) {
    if (await sql.lesson_exists(p.lesson_id)) throw new InvariantViolation("refused: target lesson already exists");
    const src = await sql.latest_derived(p.source_lesson_id);
    if (src === null) throw new InvariantViolation("refused: source lesson has no stored version");
    sources.set(p.plant_id, src);
  }

  // 2. Writes.
  const planter = await sql.ensure_planter(email);
  await sql.ensure_unit();
  const run = await deps.evidence.start_eval_run({
    suite: "S10", git_sha: deps.git_sha, prompt_version_id: null, models: { provider_mode_note: "stub runs make no model call" },
    provider_mode: "stub", case_set: `plants=${key.plants.length};key=${key.key_id}`, run_id: null,
  });
  const planted: SeedState["plants"] = [];
  for (const [i, p] of key.plants.entries()) {
    const copy = apply_plant(sources.get(p.plant_id) as NonNullable<ReturnType<typeof sources.get>>, p);
    const content_hash = await sql.plant_one(copy, planter, String(i + 1));
    planted.push({ ...p, content_hash });
  }
  const state: SeedState = { eval_run_id: run.eval_run_id, key_id: key.key_id, planter_id: planter.user_id, plants: planted };
  const file = state_path(deps.repo_root, run.eval_run_id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
  return { eval_run_id: run.eval_run_id, n: planted.length };
}
