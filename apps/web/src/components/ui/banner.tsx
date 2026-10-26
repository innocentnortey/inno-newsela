import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BannerLevel = "blocking" | "advisory" | "info" | "success";

// Look sheet banners: a 34 px icon tile whose shape differs by level (the non-colour cue), then the title and detail.
// The level word stays in the text for screen readers.
const LEVELS: Record<BannerLevel, { word: string; fill: string; tile: string; icon: ReactNode }> = {
  blocking: {
    word: "Blocking",
    fill: "bg-danger-tint",
    tile: "bg-danger text-on-danger",
    icon: (
      <>
        <path d="M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7z" />
        <path d="M8 12h8" />
      </>
    ),
  },
  advisory: {
    word: "Advisory",
    fill: "bg-warn-tint",
    tile: "bg-warn text-on-warn",
    icon: (
      <>
        <path d="M12 4 3 19.5h18z" />
        <path d="M12 10v4M12 16.8v.2" />
      </>
    ),
  },
  info: {
    word: "Info",
    fill: "bg-selected",
    tile: "bg-primary text-on-primary",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 11v5M12 8v.2" />
      </>
    ),
  },
  success: {
    word: "Success",
    fill: "bg-success-tint",
    tile: "bg-success text-on-success",
    icon: (
      <>
        <path d="M12 3.5 19.5 6v5.5c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6z" />
        <path d="m8.8 12 2.3 2.3 4.2-4.6" />
      </>
    ),
  },
};

export interface BannerProps {
  level: BannerLevel;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function Banner({ level, title, children, action }: BannerProps) {
  const l = LEVELS[level];
  return (
    <div
      role={level === "blocking" ? "alert" : "status"}
      className={cn("flex items-center gap-3 rounded-lg px-3.5 py-2.5", l.fill)}
    >
      <span className={cn("flex size-[34px] shrink-0 items-center justify-center rounded-md", l.tile)}>
        <svg aria-hidden="true" focusable="false" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {l.icon}
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-small text-ink font-semibold">
          <span className="sr-only">{l.word}</span> {title}
        </p>
        {children ? <div className="text-small text-ink2 mt-px">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
