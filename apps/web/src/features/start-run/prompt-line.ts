import type { components } from "@/lib/api-types";

type PromptVersions = components["schemas"]["PromptVersions"];

export function formatPromptLine(p: PromptVersions): string {
  const id = p.locked_layer.version_id;
  const n = /(\d+)$/.exec(id)?.[1] ?? id;
  const g = p.guidance_versions.reduce((max, v) => Math.max(max, v.number), 0);
  return `v${n} · locked rules + guidance v${g} · pinned to this run`;
}
