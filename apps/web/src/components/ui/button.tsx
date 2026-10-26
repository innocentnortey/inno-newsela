"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
} from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/** `--duration-indicator-delay` (design.md, Motion). */
export const INDICATOR_DELAY_MS = 250;

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Visible text saying why the button is off. */
  disabledReason?: string;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary/90 active:bg-primary/80",
  secondary: "bg-panel text-ink border border-hair shadow-e1 hover:bg-well active:bg-well",
  ghost: "bg-transparent text-primary hover:bg-selected active:bg-selected",
  danger: "bg-transparent text-danger hover:bg-danger-tint active:bg-danger-tint",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 text-small font-semibold",
  md: "h-9 text-body font-semibold",
  lg: "h-11 text-body font-semibold",
};

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-spinner=""
      viewBox="0 0 16 16"
      className="size-4 animate-spin"
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function Lock() {
  return (
    <svg aria-hidden="true" focusable="false" data-icon="lock" viewBox="0 0 16 16" className="size-4">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    disabledReason,
    className,
    children,
    onClick,
    type = "button",
    "aria-describedby": describedByProp,
    ...rest
  },
  ref,
) {
  const reasonId = useId();
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setShowSpinner(true), INDICATOR_DELAY_MS);
    return () => {
      clearTimeout(t);
      setShowSpinner(false);
    };
  }, [loading]);

  const inert = disabled || loading;
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const reason = disabled && disabledReason ? disabledReason : undefined;
  const button = (
    <button
      ref={ref}
      type={type}
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      aria-describedby={reason ? reasonId : describedByProp}
      data-variant={variant}
      data-size={size}
      onClick={handleClick}
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 rounded-md px-(--space-4) select-none",
        SIZES[size],
        disabled ? "bg-disabled text-ink3 border-0 shadow-none" : VARIANTS[variant],
        inert && "cursor-not-allowed",
        className,
      )}
      {...rest}
    >
      {/* No blank leading slot on idle buttons. While loading, the spinner is laid over the label (which fades but keeps
          its place and its accessible name), so the button never changes width (insert-quote "stable Insert width"). */}
      {disabled ? <Lock /> : null}
      {loading && showSpinner ? (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      ) : null}
      <span className={cn("inline-flex items-center gap-1.5", loading && showSpinner && "opacity-0")}>{children}</span>
    </button>
  );

  if (!reason) return button;
  return (
    <span className="inline-flex items-center gap-2">
      {button}
      <span id={reasonId} className="text-small text-ink2">
        {reason}
      </span>
    </span>
  );
});
