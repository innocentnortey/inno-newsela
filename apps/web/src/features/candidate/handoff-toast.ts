// SCR-9 (NL-62) will read this key and show the message; nothing in this ticket reads it.
export const HANDOFF_KEY = "ls.handoff-toast";

export function writeHandoff(message: string): void {
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ message, at: Date.now() }));
  } catch {
    /* storage unavailable: the toast on this page still showed */
  }
}
