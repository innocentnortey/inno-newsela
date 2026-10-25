import type { PromptBlock } from "./inputs.ts";

/** Break up any run of three angle brackets so text cannot open or close a data block. */
export function neutralise(s: string): string {
  return s.replaceAll("<<<", "< < <").replaceAll(">>>", "> > >");
}

export function data_block(attrs: Record<string, string | number>, text: string): PromptBlock {
  const a = Object.entries(attrs)
    .map(([k, v]) => ` ${k}=${neutralise(String(v))}`)
    .join("");
  return {
    label: "data",
    cacheable: false,
    text: `<<<OUTLINE_DATA${a}>>>\n${neutralise(text)}\n<<<END_OUTLINE_DATA>>>`,
  };
}

export function sort_keys(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(sort_keys);
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .map((k) => [k, sort_keys(o[k])]),
    );
  }
  return x;
}
