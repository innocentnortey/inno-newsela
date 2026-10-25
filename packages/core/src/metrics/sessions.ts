// NL-48: pure heartbeat merge. One person in two tabs counts once; idle counts nothing.
import type { UserId } from "../ports/common.ts";
import type { HeartbeatRecord } from "../ports/metrics.ts";

export interface ActiveInterval {
  user_id: UserId;
  start: Date;
  end: Date;
  synthetic: boolean;
}

export function merge_heartbeats(
  beats: readonly HeartbeatRecord[],
  gap_s: number,
  min_spacing_s = 10,
): ActiveInterval[] {
  const by_user = new Map<string, HeartbeatRecord[]>();
  for (const b of beats) {
    if (!b.active) continue;
    const list = by_user.get(b.user_id);
    if (list) list.push(b);
    else by_user.set(b.user_id, [b]);
  }
  const out: ActiveInterval[] = [];
  for (const user_id of [...by_user.keys()].sort()) {
    const sorted = (by_user.get(user_id) ?? [])
      .map((b, i) => ({ b, i }))
      .sort((x, y) => x.b.at.getTime() - y.b.at.getTime() || x.i - y.i)
      .map((x) => x.b);
    const last_kept = new Map<string, number>();
    let open: ActiveInterval | null = null;
    for (const b of sorted) {
      const t = b.at.getTime();
      const prev = last_kept.get(b.tab_id);
      if (prev !== undefined && t - prev < min_spacing_s * 1000) continue;
      last_kept.set(b.tab_id, t);
      if (open !== null && t - open.end.getTime() <= gap_s * 1000) {
        if (t > open.end.getTime()) open.end = new Date(t);
      } else {
        if (open !== null) out.push(open);
        open = { user_id, start: new Date(t), end: new Date(t), synthetic: b.synthetic };
      }
    }
    if (open !== null) out.push(open);
  }
  return out;
}
