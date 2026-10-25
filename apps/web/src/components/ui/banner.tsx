import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BannerLevel = "blocking" | "advisory" | "info" | "success";

const LEVELS: Record<BannerLevel, { word: string; fill: string; tile: string; icon: string }> = {
  blocking: { word: "Blocking", fill: "bg-danger-tint", tile: "bg-danger text-on-danger", icon: "M4 1h4l3 3v4l-3 3H4L1 8V4zM3.5 6h5" },
  advisory: { word: "Advisory", fill: "bg-warn-tint", tile: "bg-warn text-on-warn", icon: "M6 3v3.5M6 8.6v.1" },
  info: { word: "Info", fill: "bg-selected", tile: "bg-primary text-on-primary", icon: "M6 5.4v3M6 3.5v.1" },
  success: { word: "Success", fill: "bg-success-tint", tile: "bg-success text-on-success", icon: "m3.5 6.2 1.7 1.7 3.3-3.6" },
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
      className={cn("flex items-start gap-3 rounded-lg px-4 py-3", l.fill)}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", l.tile)}>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" className="size-4">
          <path d={l.icon} fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body text-ink font-semibold">
          <span className="text-caps mr-2 uppercase">{l.word}</span>
          {title}
        </p>
        {children ? <div className="text-small text-ink2">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
