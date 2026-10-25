import type { Role } from "@/lib/roles";

export function landingFor(role: Role): string {
  return role === "author" ? "/units" : "/units/g6-u4/board";
}

/** `next` is honoured only when it is a same-site path; anything else falls back to the role landing. */
export function resolveLanding(role: Role, next: string | null | undefined): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return landingFor(role);
  if (next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) return landingFor(role);
  let url: URL;
  try {
    url = new URL(next, "http://app.invalid");
  } catch {
    return landingFor(role);
  }
  if (url.origin !== "http://app.invalid" || url.pathname === "/sign-in") return landingFor(role);
  return next;
}
