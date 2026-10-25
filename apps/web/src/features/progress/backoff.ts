/** Thrown by the progress fetcher on a poll tick that falls inside a backoff window; no request is made. */
export class BackoffSkip extends Error {}

/** Wait before the next real request after `failures` failures in a row: 4 s, 8 s, then 10 s. */
export function backoffMs(failures: number): number {
  return Math.min(2000 * 2 ** failures, 10000);
}
