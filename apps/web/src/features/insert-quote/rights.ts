export const RIGHTS_OPTIONS: { value: "short-quote-commentary" | "public-domain" | "licensed" | "to-clear"; label: string; help: string }[] = [
  { value: "short-quote-commentary", label: "short-quote-commentary", help: "A short quote of 12 words or fewer, used with commentary." },
  { value: "public-domain", label: "public-domain", help: "Out of copyright, so no permission is needed." },
  { value: "licensed", label: "licensed", help: "Newsela holds a licence to use this text." },
  { value: "to-clear", label: "to-clear", help: "Permission is still to be requested. The lesson stays blocked until rights are recorded." },
];

export type OfferedRights = (typeof RIGHTS_OPTIONS)[number]["value"];

export function isOfferedRights(v: unknown): v is OfferedRights {
  return RIGHTS_OPTIONS.some((o) => o.value === v);
}
