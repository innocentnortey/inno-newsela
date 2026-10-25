// NL-99: the S8 scripted 3-lesson review, compressed to real seconds (the web container uses SystemClock, so stored
// minutes are server time and cannot be moved by page.clock; see the dev log). The events the oracle reads and the
// driver replays both come from this one list.
export type Who = "A" | "B";
export interface TabPlan {
  tab: string;
  who: Who;
  mode: "active" | "idle"; // idle: one input at t = 0, then none
}
export interface Segment {
  lesson: 1 | 2 | 3;
  seconds: number;
  tabs: TabPlan[];
}
export const BEAT_S = 15;
export const IDLE_S = 60;

export const S8: readonly Segment[] = [
  { lesson: 1, seconds: 90, tabs: [{ tab: "T1", who: "A", mode: "active" }] },
  { lesson: 2, seconds: 90, tabs: [{ tab: "T1", who: "A", mode: "active" }] },
  {
    lesson: 3,
    seconds: 120,
    tabs: [
      { tab: "T1", who: "A", mode: "active" },
      { tab: "T2", who: "A", mode: "active" },
      { tab: "T3", who: "B", mode: "idle" },
    ],
  },
];

export interface BeatEvent {
  lesson: number;
  tab: string;
  who: Who;
  t: number; // seconds into the segment
  focused: boolean;
  visible: boolean;
  last_input_age: number; // seconds since the tab's last input
}

// Every beat the real sender would send: one per 15 s tick, skipped client-side once input is older than 60 s.
export function events(seg: Segment): BeatEvent[] {
  const out: BeatEvent[] = [];
  for (const p of seg.tabs) {
    for (let t = BEAT_S; t <= seg.seconds; t += BEAT_S) {
      const age = p.mode === "active" ? 0 : t;
      if (age > IDLE_S) continue; // the sender does not send
      out.push({ lesson: seg.lesson, tab: p.tab, who: p.who, t, focused: true, visible: true, last_input_age: age });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
