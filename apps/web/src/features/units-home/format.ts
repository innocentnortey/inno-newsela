export function shortHash(sha: string): string {
  return sha.slice(0, 8);
}

export function formatUploaded(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function progressText(counts: Record<string, number>): string {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return `${counts.ready ?? 0} of ${total} ready`;
}

export const MVP_UNIT_KEY = "g6-u4";

export function routes(unitKey: string) {
  return {
    board: `/units/${unitKey}/board`,
    upload: `/units/${unitKey}/outlines/new`,
    report: (n: number) => `/units/${unitKey}/outlines/${n}`,
    run: (id: string) => `/units/${unitKey}/runs/${id}`,
  };
}
