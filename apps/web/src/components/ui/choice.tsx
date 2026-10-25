import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type BoxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode };

export const Checkbox = forwardRef<HTMLInputElement, BoxProps>(function Checkbox(
  { label, className, ...rest },
  ref,
) {
  return (
    <label className="text-body text-ink inline-flex items-center gap-2">
      <input ref={ref} type="checkbox" className={cn("accent-primary size-4", className)} {...rest} />
      <span>{label}</span>
    </label>
  );
});

export const Radio = forwardRef<HTMLInputElement, BoxProps>(function Radio(
  { label, className, ...rest },
  ref,
) {
  return (
    <label className="text-body text-ink inline-flex items-center gap-2">
      <input ref={ref} type="radio" className={cn("accent-primary size-4", className)} {...rest} />
      <span>{label}</span>
    </label>
  );
});

export function RadioGroup({
  legend,
  required,
  children,
  className,
}: {
  legend: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend className="text-small text-ink mb-1 font-semibold">
        {legend}
        {required ? <span className="text-ink2 ml-1 font-normal">(required)</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}

export const RadioCard = forwardRef<HTMLInputElement, BoxProps>(function RadioCard(
  { label, className, ...rest },
  ref,
) {
  return (
    <label
      className={cn(
        "bg-well text-body text-ink flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-transparent px-3 py-2",
        "has-[:checked]:bg-selected has-[:checked]:border-primary has-[:checked]:font-semibold",
        className,
      )}
    >
      <input ref={ref} type="radio" className="accent-primary size-4" {...rest} />
      <span>{label}</span>
    </label>
  );
});
