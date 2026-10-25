export function unitLabel(unitKey: string): string {
  const m = /^g(\d+)-u(\d+)$/i.exec(unitKey);
  return m ? `Grade ${Number(m[1])} · Unit ${Number(m[2])}` : unitKey;
}
