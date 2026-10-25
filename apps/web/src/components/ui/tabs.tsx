"use client";

import * as RT from "@radix-ui/react-tabs";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export const Tabs = RT.Root;

export function TabsList({ className, ...rest }: ComponentPropsWithoutRef<typeof RT.List>) {
  return <RT.List className={cn("border-hair flex flex-wrap gap-x-4 border-b", className)} {...rest} />;
}

export function TabsTrigger({
  count,
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<typeof RT.Trigger> & { count?: number }) {
  return (
    <RT.Trigger
      className={cn(
        "text-small text-ink2 -mb-px border-b-2 border-transparent py-2 font-semibold",
        "data-[state=active]:text-ink data-[state=active]:border-primary",
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined ? <span className="ml-1 tabular-nums">{count}</span> : null}
    </RT.Trigger>
  );
}

export const TabsContent = RT.Content;
