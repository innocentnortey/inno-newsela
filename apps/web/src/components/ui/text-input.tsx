import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { CONTROL_CLASS, Field, useFieldIds } from "./field";

interface Common {
  label: string;
  help?: string;
  error?: string;
}

export type TextInputProps = Common & Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & { id?: string };
export type TextareaProps = Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & { id?: string };

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, help, error, className, id, ...rest },
  ref,
) {
  const f = useFieldIds(!!help, !!error);
  const inputId = id ?? f.inputId;
  return (
    <Field label={label} inputId={inputId} helpId={f.helpId} errorId={f.errorId} help={help} error={error}>
      <input
        ref={ref}
        id={inputId}
        aria-describedby={f.describedBy}
        aria-invalid={f.invalid}
        className={cn(CONTROL_CLASS, "h-9", error ? "border-danger" : "border-edge", className)}
        {...rest}
      />
    </Field>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, help, error, className, id, ...rest },
  ref,
) {
  const f = useFieldIds(!!help, !!error);
  const inputId = id ?? f.inputId;
  return (
    <Field label={label} inputId={inputId} helpId={f.helpId} errorId={f.errorId} help={help} error={error}>
      <textarea
        ref={ref}
        id={inputId}
        aria-describedby={f.describedBy}
        aria-invalid={f.invalid}
        className={cn(CONTROL_CLASS, "min-h-20 py-2", error ? "border-danger" : "border-edge", className)}
        {...rest}
      />
    </Field>
  );
});
