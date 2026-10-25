export function findBlock(
  css: string,
  header: string,
  from = 0,
): { body: string; end: number } | null {
  const start = css.indexOf(header + " {", from);
  if (start === -1) return null;
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return { body: css.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

export function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const value = m[2].trim();
    if (m[1] === "--color-*" || value === "initial") continue;
    out.set(m[1], value);
  }
  return out;
}
