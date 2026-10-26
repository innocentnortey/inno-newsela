import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  caption: string;
  captionHidden?: boolean;
}

export function Table({ caption, captionHidden, className, children, ...rest }: TableProps) {
  return (
    <div className="relative max-w-full overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
      <table className={cn("w-full border-collapse", className)} {...rest}>
        <caption className={captionHidden ? "sr-only" : "text-label text-ink2 pb-2 text-left"}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const Thead = (p: HTMLAttributes<HTMLTableSectionElement>) => <thead {...p} />;
export const Tbody = (p: HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} />;
export const Tr = (p: HTMLAttributes<HTMLTableRowElement>) => <tr {...p} />;

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  sort?: "ascending" | "descending" | "none";
}

export function Th({ scope = "col", numeric, sort, className, ...rest }: ThProps) {
  return (
    <th
      scope={scope}
      aria-sort={sort}
      className={cn(
        "text-label text-ink3 border-hair border-b px-3 pb-2",
        numeric ? "text-center tabular-nums" : "text-left",
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ numeric, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn("text-body border-hair border-b p-3 align-top", numeric && "text-center tabular-nums", className)}
      {...rest}
    />
  );
}
