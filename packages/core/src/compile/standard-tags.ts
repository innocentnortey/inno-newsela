/** The one writer and reader of the standard-code tag on a heading: "Label (CODE, CODE)". */
export const MAX_CODES_PER_CHECK = 2;

const CODE = /^[A-Z]{1,5}(?:\.[A-Za-z0-9]+)+$/; // RL.6.1  L.6.4.b  W.6.2.f  ELD.PI.6.6b

export type ParsedTag = { label: string; codes: string[] };

/** "Label (A, B)" -> {label, codes}. strict: every token must look like a standard code; loose: any non-empty token. */
export function parse_tag(text: string, strict: boolean): ParsedTag | null {
  const m = /^(.*\S)\s*\(([^()]*)\)\s*$/.exec(text.trim());
  if (m === null) return null;
  const tokens = (m[2] ?? "").split(",").map((t) => t.trim()).filter((t) => t !== "");
  if (tokens.length === 0) return null;
  if (strict && tokens.some((t) => !CODE.test(t))) return null;
  return { label: (m[1] ?? "").trim(), codes: [...new Set(tokens)] };
}

/** "Label" + codes -> "Label (A, B)". Strips a tag the text already ends with, so a tag is never doubled. */
export function format_tag(label: string, codes: readonly string[]): string {
  const base = parse_tag(label, false)?.label ?? label.trim();
  const distinct = [...new Set(codes.map((c) => c.trim()).filter((c) => c !== ""))];
  return distinct.length === 0 ? base : `${base} (${distinct.join(", ")})`;
}
