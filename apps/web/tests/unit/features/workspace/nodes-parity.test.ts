import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { READ_VIEW_MARKS, READ_VIEW_NODES } from "@/features/workspace/read-view/nodes";

const src = readFileSync(path.resolve(process.cwd(), "../../packages/editor-schema/src/schema.ts"), "utf8");
const names = (block: string) => [...block.matchAll(/^ {2}([a-z_]+): \{/gm)].map((m) => m[1]!).sort();

describe("read view allowlist", () => {
  it("allowlist_matches_editor_schema", () => {
    const nodes = src.slice(src.indexOf("const nodes: Record<string, NodeSpec> = {"), src.indexOf("const marks:"));
    const marks = src.slice(src.indexOf("const marks:"), src.indexOf("export const EDITOR_SCHEMA"));
    expect(names(nodes)).toEqual([...READ_VIEW_NODES].sort());
    expect(names(marks)).toEqual([...READ_VIEW_MARKS].sort());
  });
});
