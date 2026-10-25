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
  { id: "board", label: "Unit board", href: "/units/g6-u4/board", roles: "all" },
  { id: "prompt-guidance", label: "Prompt guidance", href: "/prompt-guidance", roles: ["author"], cut: 7 },
];

export function buildNav(role: Role, pathname: string, fired: readonly number[] = FIRED_CUTS): NavSection[] {
  const items = NAV_ENTRIES.filter(
    (e) => (e.roles === "all" || e.roles.includes(role)) && (e.cut === undefined || !fired.includes(e.cut)),
  ).map((e) => ({
    id: e.id,
    label: e.label,
    href: e.href,
    current: pathname === e.href || pathname.startsWith(e.href + "/"),
  }));
  return [{ id: "main", items }];
}
