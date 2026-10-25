import type { VersionEntry } from "@/features/history/derive";

export const hash = (n: number) =>
  n.toString(16).padStart(4, "0") + "0".repeat(60);

export function version(
  over: Partial<VersionEntry> & { version_number: number },
): VersionEntry {
  return {
    version_id: `lv-4-${over.version_number}`,
    kind: "generated",
    content_hash: hash(over.version_number),
    created_at: "2026-10-25T09:00:00Z",
    created_by: "worker",
    adopted: null,
    provenance: {
      outline_row_hash: hash(900),
      prompt_version_id: "pv-7",
      model: "model-x",
      parameters: null,
      schema_version: 3,
      example_set_id: "ex-1",
      run_id: "run-0001",
      cost_usd: 0.52,
      derived_from_version_id: null,
    },
    ...over,
  } as VersionEntry;
}
