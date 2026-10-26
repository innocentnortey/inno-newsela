import type { NavSection } from "@/components/layout";
import type { Role } from "@/lib/roles";

export interface NavEntry {
  id: string;
  label: string;
  href: string;
  roles: Role[] | "all";
  /** Scope cut number; the entry is hidden once that cut has fired. */
  cut?: number;
}

export const FIRED_CUTS: readonly number[] = [];

export const NAV_ENTRIES: NavEntry[] = [
  { id: "units", label: "Units", href: "/units", roles: "all" },
  // The board href depends on the unit in view; buildNav fills it in (see boardHref).
  { id: "board", label: "Unit board", href: "/units", roles: "all" },
  { id: "prompt-guidance", label: "Prompt guidance", href: "/prompt-guidance", roles: ["author"], cut: 7 },
];

/** The unit key named by a `/units/<key>/…` path, else null (`/units` alone names none). */
export function unitKeyFromPath(pathname: string): string | null {
  const m = /^\/units\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!) || null;
  } catch {
    return m[1]!;
  }
}

/** The unit whose newest version is the most recent; ties go to a unit with a run, then the first listed. */
export function pickRecentUnitKey(
  units: readonly { unit_key: string; versions: readonly { created_at: string }[]; latest_run: unknown }[],
): string | null {
  let best: { key: string; at: number; run: boolean } | null = null;
  for (const u of units) {
    const at = u.versions.reduce((m, v) => Math.max(m, Date.parse(v.created_at) || 0), 0);
    const run = u.latest_run !== null && u.latest_run !== undefined;
    if (!best || at > best.at || (at === best.at && run && !best.run)) best = { key: u.unit_key, at, run };
  }
  return best?.key ?? null;
}

export function boardHref(unitKey: string | null): string {
  return unitKey ? `/units/${encodeURIComponent(unitKey)}/board` : "/units";
}

export function buildNav(
  role: Role,
  pathname: string,
  fired: readonly number[] = FIRED_CUTS,
  unitKey: string | null = null,
): NavSection[] {
  const items = NAV_ENTRIES.filter(
    (e) => (e.roles === "all" || e.roles.includes(role)) && (e.cut === undefined || !fired.includes(e.cut)),
  ).map((e) => (e.id === "board" ? { ...e, href: boardHref(unitKey) } : e));
  // Exactly one entry is current: the longest href that equals the path or is a path prefix of it.
  let best: NavEntry | undefined;
  for (const e of items) {
    // With no unit to point at, the board link falls back to /units, which the Units entry owns.
    if (e.id === "board" && e.href === "/units") continue;
    if ((pathname === e.href || pathname.startsWith(e.href + "/")) && (!best || e.href.length > best.href.length)) best = e;
  }
  return [{ id: "main", items: items.map((e) => ({ id: e.id, label: e.label, href: e.href, current: e === best })) }];
}
