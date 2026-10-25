// NL-88: pure line diff for guidance versions. `-line` removed, `+line` added, unchanged lines omitted.
// Deterministic and computed against the named base only.
const LCS_LIMIT = 4_000_000;

const lines_of = (s: string): string[] => (s === "" ? [] : s.split("\n"));

export function diff_lines(base: string, next: string): string {
  const a = lines_of(base);
  const b = lines_of(next);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let ea = a.length;
  let eb = b.length;
  while (ea > start && eb > start && a[ea - 1] === b[eb - 1]) {
    ea--;
    eb--;
  }
  const ma = a.slice(start, ea);
  const mb = b.slice(start, eb);
  const out: string[] = [];
  if (ma.length * mb.length > LCS_LIMIT) {
    for (const l of ma) out.push("-" + l);
    for (const l of mb) out.push("+" + l);
    return out.join("\n");
  }
  const w = mb.length + 1;
  const t = new Uint32Array((ma.length + 1) * w);
  for (let i = ma.length - 1; i >= 0; i--) {
    for (let j = mb.length - 1; j >= 0; j--) {
      t[i * w + j] = ma[i] === mb[j] ? t[(i + 1) * w + j + 1]! + 1 : Math.max(t[(i + 1) * w + j]!, t[i * w + j + 1]!);
    }
  }
  let i = 0;
  let j = 0;
  while (i < ma.length || j < mb.length) {
    if (i < ma.length && j < mb.length && ma[i] === mb[j]) {
      i++;
      j++;
    } else if (i < ma.length && (j === mb.length || t[(i + 1) * w + j]! >= t[i * w + j + 1]!)) {
      out.push("-" + ma[i++]);
    } else {
      out.push("+" + mb[j++]);
    }
  }
  return out.join("\n");
}
