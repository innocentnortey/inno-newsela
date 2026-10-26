import "./globals.css";
import type { Metadata } from "next";
import { THEME_BOOTSTRAP } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Lesson Studio",
  description: "Newsela Lesson Studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Light is the default theme (design.md "Design tokens"); a stored dark or "match system" choice (DQ-4) is applied
  // before first paint by the bootstrap, which is why React must not warn about the attribute it may change.
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
