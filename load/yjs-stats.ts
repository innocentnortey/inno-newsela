// NL-119: pure helpers for the Yjs socket load script (no I/O).

/** Nearest-rank percentile (p in 0..100). An empty list gives 0. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((Math.min(100, Math.max(0, p)) / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]!;
}

export interface LostUpdates {
  lost_updates: number;
  lost: string[];
}

/** An acknowledged token is lost when the stored text no longer contains it. */
export function count_lost(acknowledged: readonly string[], present_text: string): LostUpdates {
  const lost = acknowledged.filter((t) => !present_text.includes(t));
  return { lost_updates: lost.length, lost };
}

/** Extra copies: for each token, occurrences beyond the first. */
export function count_duplicates(sent: readonly string[], present_text: string): number {
  let extra = 0;
  for (const token of new Set(sent)) {
    let n = 0;
    for (let at = present_text.indexOf(token); at >= 0; at = present_text.indexOf(token, at + token.length)) n += 1;
    extra += Math.max(0, n - 1);
  }
  return extra;
}

export function error_rate(failures: number, sockets_opened: number): number {
  return Math.min(1, Math.max(0, failures / Math.max(1, sockets_opened)));
}

export const make_token = (editor: string, seq: number): string => `[${editor}-${seq}]`;

export interface LinkView {
  sender_up: boolean;
  peer_up: boolean;
  sender_epoch: number;
  peer_epoch: number;
}
/** A remote-edit sample is clean only if both ends were up when the edit was made and neither dropped before it was seen. */
export function is_clean_sample(at_send: LinkView, at_seen: LinkView): boolean {
  return (
    at_send.sender_up && at_send.peer_up && at_seen.sender_up && at_seen.peer_up &&
    at_send.sender_epoch === at_seen.sender_epoch && at_send.peer_epoch === at_seen.peer_epoch
  );
}

export interface SendView {
  up: boolean;
  epoch: number;
}
/** A stored sample is clean only if the sender's socket was up at send and never dropped before the ack. */
export function is_clean_stored(at_send: SendView, at_ack: SendView): boolean {
  return is_clean_sample(
    { sender_up: at_send.up, peer_up: true, sender_epoch: at_send.epoch, peer_epoch: 0 },
    { sender_up: at_ack.up, peer_up: true, sender_epoch: at_ack.epoch, peer_epoch: 0 },
  );
}
