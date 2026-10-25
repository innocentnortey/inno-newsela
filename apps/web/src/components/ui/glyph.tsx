import type { ReactNode } from "react";
import type { GlyphShape } from "./status";

const PATHS: Record<Exclude<GlyphShape, "none">, ReactNode> = {
  "circle-open": <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  "circle-dashed": <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />,
  "circle-half": (
    <>
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" />
    </>
  ),
  "circle-back": (
    <>
      <circle cx="6" cy="6" r="5.5" fill="currentColor" />
      <path d="M8 6H4M5.5 4.5 4 6l1.5 1.5" fill="none" stroke="var(--color-panel)" strokeWidth="1.2" />
    </>
  ),
  "circle-up": (
    <>
      <circle cx="6" cy="6" r="5.5" fill="currentColor" />
      <path d="M6 9V3.5M4 5.5l2-2 2 2" fill="none" stroke="var(--color-panel)" strokeWidth="1.2" />
    </>
  ),
  "circle-check": (
    <>
      <circle cx="6" cy="6" r="5.5" fill="currentColor" />
      <path d="m3.5 6.2 1.7 1.7 3.3-3.6" fill="none" stroke="var(--color-panel)" strokeWidth="1.3" />
    </>
  ),
  "circle-turn": (
    <>
      <circle cx="6" cy="6" r="5.5" fill="currentColor" />
      <path d="M8 8a2.7 2.7 0 1 0-2-4.5M8 2.8v2H6" fill="none" stroke="var(--color-panel)" strokeWidth="1.1" />
    </>
  ),
  "square-out": (
    <>
      <rect x="0.5" y="0.5" width="11" height="11" rx="2" fill="currentColor" />
      <path d="M4 8l4-4M5 4h3v3" fill="none" stroke="var(--color-panel)" strokeWidth="1.2" />
    </>
  ),
  square: <rect x="0.5" y="0.5" width="11" height="11" rx="2" fill="currentColor" />,
  "triangle-bang": (
    <>
      <path d="M6 0.8 11.5 10.8H0.5z" fill="currentColor" />
      <path d="M6 4.5v3M6 8.6v.1" stroke="var(--color-panel)" strokeWidth="1.3" />
    </>
  ),
  "circle-half-wrench": (
    <>
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" />
      <path d="M1 11 4 8" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  "circle-bang": (
    <>
      <circle cx="6" cy="6" r="5.5" fill="currentColor" />
      <path d="M6 3v3.5M6 8.4v.1" stroke="var(--color-panel)" strokeWidth="1.3" />
    </>
  ),
  "circle-pause": (
    <>
      <circle cx="6" cy="6" r="5.5" fill="currentColor" />
      <path d="M4.6 3.8v4.4M7.4 3.8v4.4" stroke="var(--color-panel)" strokeWidth="1.3" />
    </>
  ),
  "octagon-bar": (
    <>
      <path d="M4 .5h4L11.5 4v4L8 11.5H4L.5 8V4z" fill="currentColor" />
      <path d="M3.5 6h5" stroke="var(--color-panel)" strokeWidth="1.4" />
    </>
  ),
  "circle-i": (
    <>
      <circle cx="6" cy="6" r="5.5" fill="currentColor" />
      <path d="M6 5.4v3M6 3.5v.1" stroke="var(--color-panel)" strokeWidth="1.3" />
    </>
  ),
  diamond: <path d="M6 .5 11.5 6 6 11.5.5 6z" fill="currentColor" />,
};

export function Glyph({ shape, className }: { shape: GlyphShape; className?: string }) {
  if (shape === "none") return null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-glyph={shape}
      viewBox="0 0 12 12"
      width={12}
      height={12}
      className={className ?? "shrink-0"}
    >
      {PATHS[shape]}
    </svg>
  );
}
