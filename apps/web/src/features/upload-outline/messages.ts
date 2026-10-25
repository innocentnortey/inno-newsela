import { isApiError, type ApiErrorCode } from "@/lib/api-client";
import type { components } from "@/lib/api-types";

type OutlineVersion = components["schemas"]["OutlineVersion"];

export type UploadError = { code: ApiErrorCode | "NO_FILE" | "NO_LINK"; text: string; retry: boolean };

export const MSG_EXT = "This file type isn't supported. Upload a CSV or XLSX file.";

function headerNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .slice(0, 20)
    .map((s) => s.slice(0, 60));
}

export function toUploadError(e: unknown): UploadError {
  if (!isApiError(e)) return { code: "NETWORK", text: "Couldn't reach Lesson Studio. Try again.", retry: true };
  const code = e.code;
  const d = e.details ?? {};
  switch (code) {
    case "SHEET_NOT_PUBLIC":
      return { code, text: "This sheet is private. Share it publicly or upload the file.", retry: false };
    case "UNSUPPORTED_FILE":
      return {
        code,
        text: d.reason === "too_large" ? "This file is over 5 MB. Upload a smaller CSV or XLSX file." : MSG_EXT,
        retry: false,
      };
    case "HEADER_NOT_FOUND": {
      const names = headerNames(d.columns_looked_for);
      return {
        code,
        text: names.length
          ? `Couldn't find the header row. We looked for these columns: ${names.join(", ")}.`
          : "Couldn't find the header row.",
        retry: false,
      };
    }
    case "TOO_MANY_ROWS": {
      const rows = typeof d.rows === "number" ? d.rows : null;
      const max = typeof d.max_rows === "number" ? d.max_rows : 200;
      return {
        code,
        text:
          rows !== null
            ? `Too many rows for one unit: this sheet has ${rows} rows; the limit is ${max}.`
            : `Too many rows for one unit: the limit is ${max}.`,
        retry: false,
      };
    }
    case "SHEET_UNREACHABLE":
      return { code, text: "Couldn't reach Google Sheets. Try again, or upload the file.", retry: true };
    case "ROLE_FORBIDDEN":
      return { code, text: "Only authors can upload an outline.", retry: false };
    case "NETWORK":
      return { code, text: "Couldn't reach Lesson Studio. Try again.", retry: true };
    default:
      return { code, text: "Couldn't upload this outline. Nothing was stored. Try again.", retry: true };
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function successLine(v: OutlineVersion): string {
  const m = /^G(\d+)\.U(\d+)$/.exec(v.unit_id);
  const where = m ? `Grade ${Number(m[1])} · Unit ${Number(m[2])}` : v.unit_key;
  const c = v.row_counts;
  return [
    where,
    `version ${v.version_number}`,
    plural(c.lessons, "lesson"),
    plural(c.flex_days, "flex day"),
    plural(c.arc_headers, "arc header"),
    plural(c.total_rows, "total row"),
  ].join(" · ");
}

export function sameHashLine(v: OutlineVersion): string {
  return `Version ${v.version_number} is the same as version ${v.same_as_version}; ${plural(v.changed_lessons, "lesson")} changed.`;
}

export const reportHref = (v: OutlineVersion) => `/units/${v.unit_key}/outlines/${v.version_number}`;
