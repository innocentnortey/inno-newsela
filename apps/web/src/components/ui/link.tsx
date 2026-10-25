import { forwardRef, type AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /** Opens in a new tab and shows the out-arrow. */
  external?: boolean;
  /** Inside reading text: always underlined. */
  inText?: boolean;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { external = false, inText = false, className, children, ...rest },
  ref,
) {
  return (
    <a
      ref={ref}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "text-primary rounded-xs",
        inText ? "underline" : "font-semibold hover:underline",
        className,
      )}
      {...rest}
    >
      {children}
      {external ? (
        <svg
          aria-hidden="true"
          focusable="false"
          data-icon="out-arrow"
          viewBox="0 0 12 12"
          className="ml-1 inline size-3"
        >
          <path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ) : null}
    </a>
  );
});
