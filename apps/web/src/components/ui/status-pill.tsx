import { cn } from "@/lib/cn";
import { Glyph } from "./glyph";
import { STATUS_SPECS, type StatusKey, type Tone } from "./status";

const TONES: Record<Tone, string> = {
  "neutral-ink2": "bg-well text-ink2",
  "neutral-ink3": "bg-well text-ink3",
  info: "bg-selected text-primary",
  warn: "bg-warn-tint text-warn",
  success: "bg-success-tint text-success",
  danger: "bg-danger-tint text-danger",
  plain: "bg-transparent text-ink",
};

export interface StatusPillProps {
  /** The state to show. A pill never decides a state. */
  status: StatusKey;
  /** Who resolved or fixed it ("Resolved by Sam"). */
  by?: string;
  /** Extra detail in brackets ("1 repair"). */
  detail?: string;
}

export function StatusPill({ status, by, detail }: StatusPillProps) {
  const spec = STATUS_SPECS[status];
  const text = [spec.label, by ? `by ${by}` : null, detail ? `(${detail})` : null].filter(Boolean).join(" ");
  return (
    <span
      data-status={status}
      className={cn(
        "text-label inline-flex h-[22px] items-center gap-1.5 rounded-sm pr-2",
        spec.glyph === "none" ? "pl-0" : "pl-1.5",
        TONES[spec.tone],
      )}
    >
      <Glyph shape={spec.glyph} />
      <span>{text}</span>
    </span>
  );
}
