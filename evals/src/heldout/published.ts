// NL-121: the only reader of the restricted published folder. Returns derived facts only; every
// exception is discarded (a JSON parse error can quote file text).
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LessonFacts } from "./compare.ts";

export type PublishedRead = { kind: "ok"; facts: LessonFacts } | { kind: "missing" } | { kind: "unreadable" };

export const DEFAULT_PUBLISHED_DIR = "docs/source/restricted/originals/lessons-json"; // relative to repo_root
export const published_file_name = (n: number): string => `g6-u4-l${String(n).padStart(2, "0")}.json`;

const is_obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function derive(raw: unknown): LessonFacts | null {
  if (!is_obj(raw) || typeof raw["type"] !== "string") return null;
  const lists = raw["standard_lists"];
  const sections = is_obj(raw["sections"]) ? raw["sections"]["teacher"] : undefined;
  if (!Array.isArray(lists) || !Array.isArray(sections)) return null;
  const focus_list = lists.find((l) => is_obj(l) && l["title"] === "California CCSS: Focus Standards");
  const focus: string[] = [];
  if (focus_list !== undefined && is_obj(focus_list)) {
    const standards = focus_list["standards"];
    if (!Array.isArray(standards)) return null;
    for (const s of standards) {
      if (!is_obj(s) || typeof s["code"] !== "string") return null;
      focus.push(s["code"]);
    }
  }
  const titles: string[] = [];
  for (const s of sections) {
    if (!is_obj(s) || typeof s["title"] !== "string") return null;
    titles.push(s["title"]);
  }
  return { type: raw["type"], sections: titles, focus };
}

export function read_published(dir: string, n: number): PublishedRead {
  const file = path.join(dir, published_file_name(n));
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "ENOENT" ? { kind: "missing" } : { kind: "unreadable" };
  }
  try {
    const facts = derive(JSON.parse(text));
    return facts === null ? { kind: "unreadable" } : { kind: "ok", facts };
  } catch {
    return { kind: "unreadable" };
  }
}
