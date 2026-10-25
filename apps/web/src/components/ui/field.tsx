import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function useFieldIds(hasHelp: boolean, hasError: boolean) {
  const base = useId();
  const inputId = `${base}-input`;
  const helpId = `${base}-help`;
  const errorId = `${base}-error`;
  const describedBy = [hasHelp ? helpId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;
  return { inputId, helpId, errorId, describedBy, invalid: hasError || undefined };
}

export interface FieldProps {
  label: string;
  inputId: string;
  helpId: string;
  errorId: string;
  help?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, inputId, helpId, errorId, help, error, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className="text-small font-semibold text-ink">
        {label}
      </label>
      {children}
      {help ? (
        <p id={helpId} className="text-small text-ink2">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-small text-danger flex items-start gap-1">
          <svg aria-hidden="true" focusable="false" data-icon="octagon" viewBox="0 0 12 12" className="mt-0.5 size-3 shrink-0">
            <path d="M4 1h4l3 3v4l-3 3H4L1 8V4z" fill="currentColor" />
          </svg>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export const CONTROL_CLASS =
  "w-full rounded-md border bg-panel px-3 text-body text-ink hover:border-ink3 focus-visible:border-primary " +
  "disabled:bg-disabled disabled:text-ink3 read-only:bg-well read-only:border-transparent";
