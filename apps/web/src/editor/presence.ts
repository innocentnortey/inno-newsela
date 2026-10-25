export interface PresenceEntry {
  client_id: number;
  name: string;
  initials: string;
  slot: 1 | 2 | 3 | 4;
  section_address: string | null;
  section_name: string | null;
}

export function initials_of(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w !== "");
  if (letters.length === 0) return "?";
  if (letters.length === 1) return letters[0]!.charAt(0).toUpperCase();
  return (letters[0]!.charAt(0) + letters[letters.length - 1]!.charAt(0)).toUpperCase();
}

export function slot_of(user_id: string): 1 | 2 | 3 | 4 {
  let h = 0;
  for (let i = 0; i < user_id.length; i++) h = (h * 31 + user_id.charCodeAt(i)) >>> 0;
  return ((h % 4) + 1) as 1 | 2 | 3 | 4;
}

export function presence_entries(
  states: Map<number, unknown>,
  own_client_id: number,
  section_names: Map<string, string>,
): PresenceEntry[] {
  const out: PresenceEntry[] = [];
  for (const [client_id, state] of states) {
    if (client_id === own_client_id || typeof state !== "object" || state === null) continue;
    const s = state as { user?: unknown; section?: unknown };
    const u = s.user as { name?: unknown; initials?: unknown; slot?: unknown } | undefined;
    if (typeof u !== "object" || u === null) continue;
    if (typeof u.name !== "string" || typeof u.initials !== "string") continue;
    if (u.slot !== 1 && u.slot !== 2 && u.slot !== 3 && u.slot !== 4) continue;
    const section_address = typeof s.section === "string" ? s.section : null;
    out.push({
      client_id,
      name: u.name,
      initials: u.initials,
      slot: u.slot,
      section_address,
      section_name: section_address ? (section_names.get(section_address) ?? null) : null,
    });
  }
  return out.sort((a, b) => a.client_id - b.client_id);
}

export function presence_sentence(entries: PresenceEntry[]): string {
  if (entries.length === 0) return "";
  const first = entries[0]!;
  if (entries.length === 1) {
    return first.section_name ? `${first.name} is editing ${first.section_name}` : `${first.name} is in this lesson`;
  }
  const n = entries.length - 1;
  return `${first.name} and ${n} other${n === 1 ? "" : "s"} are editing`;
}
