// NL-92: the hidden answer key (PRD R-52). Read from evals/local/ only; never printed, never tracked by git.
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { InvariantViolation } from "@ls/core/errors";
import { LessonId } from "@ls/schema/ids";
import { z } from "zod";
import { PLANT_KINDS, type Plant } from "./mutations.ts";

const Entry = z.object({
  plant_id: z.string().min(1),
  lesson_id: LessonId,
  source_lesson_id: LessonId,
  kind: z.enum(PLANT_KINDS),
  locator: z.string().min(1),
  marker: z.string().min(1),
});
export const SeedKey = z.array(Entry).min(1);

export interface LoadedKey {
  key_id: string;
  plants: Plant[];
}

function is_tracked(repo_root: string, abs: string): boolean {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", abs], { cwd: repo_root, stdio: "ignore" });
    return true;
  } catch {
    return false; // not tracked (or not a git checkout)
  }
}

export async function read_key(key_path: string, repo_root: string): Promise<LoadedKey> {
  const abs = path.resolve(repo_root, key_path);
  const local = path.join(path.resolve(repo_root), "evals", "local") + path.sep;
  if (!abs.startsWith(local)) throw new InvariantViolation("key file must live under evals/local/");
  if (is_tracked(repo_root, abs)) throw new InvariantViolation("key file is tracked by git");
  const raw = await fs.readFile(abs, "utf8").catch(() => null);
  if (raw === null) throw new InvariantViolation("key file not readable");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new InvariantViolation("key file is not JSON");
  }
  const parsed = SeedKey.safeParse(json);
  if (!parsed.success) throw new InvariantViolation("key file shape invalid", { issues: parsed.error.issues.length }); // never the content
  const ids = parsed.data.map((p) => p.plant_id);
  if (new Set(ids).size !== ids.length || new Set(parsed.data.map((p) => p.lesson_id)).size !== ids.length) {
    throw new InvariantViolation("key plants must be distinct");
  }
  return { key_id: path.basename(abs, ".json"), plants: parsed.data };
}
