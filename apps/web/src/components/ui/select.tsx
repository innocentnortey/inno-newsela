import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { CONTROL_CLASS, Field, useFieldIds } from "./field";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  id?: string;
  label: string;
  help?: string;
  error?: string;
  options?: { value: string; label: string }[];
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, help, error, options, children, className, id, ...rest },
  ref,
) {
  const f = useFieldIds(!!help, !!error);
  const inputId = id ?? f.inputId;
  return (
    <Field label={label} inputId={inputId} helpId={f.helpId} errorId={f.errorId} help={help} error={error}>
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          aria-describedby={f.describedBy}
          aria-invalid={f.invalid}
          className={cn(CONTROL_CLASS, "h-9 appearance-none pr-9", error ? "border-danger" : "border-edge", className)}
          {...rest}
        >
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        <svg
          aria-hidden="true"
          focusable="false"
          data-icon="chevron"
          viewBox="0 0 16 16"
          className="text-ink2 pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        >
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </Field>
  );
});
