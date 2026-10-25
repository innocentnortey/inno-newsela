"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DialogShellProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  eyebrow?: string;
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
  children?: ReactNode;
  /** A request is in flight: Escape and outside clicks do not close. */
  busy?: boolean;
}

const WIDTH = { sm: "max-w-[440px]", md: "max-w-[560px]", lg: "max-w-[720px]" } as const;

export function DialogShell({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  eyebrow,
  size = "md",
  footer,
  children,
  busy,
}: DialogShellProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="bg-scrim fixed inset-0 z-(--z-dialog)" />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          onEscapeKeyDown={(e) => busy && e.preventDefault()}
          onPointerDownOutside={(e) => busy && e.preventDefault()}
          onInteractOutside={(e) => busy && e.preventDefault()}
          className={cn(
            "bg-overlay shadow-e3 fixed top-1/2 left-1/2 z-(--z-dialog) w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl",
            WIDTH[size],
          )}
        >
          <header className="flex items-start justify-between gap-4 px-6 pt-6">
            <div>
              {eyebrow ? <p className="text-caps text-ink3 uppercase">{eyebrow}</p> : null}
              <Dialog.Title className="text-title text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-small text-ink2 mt-1">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close aria-label="Close" className="text-ink2 hover:bg-well rounded-md p-1">
              <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" className="size-4">
                <path d="m3 3 10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </Dialog.Close>
          </header>
          <div className="p-6">{children}</div>
          {footer ? <footer className="flex justify-end gap-2 px-6 pb-6">{footer}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
