import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev-only "N" indicator floats over the nav rail's bottom item (the settings gear) and swallows clicks in e2e.
  devIndicators: false,
  transpilePackages: ["@ls/config", "@ls/obs", "@ls/db"],
  serverExternalPackages: ["pg"],
  output: "standalone",
  // The production build type-checks app code only; tests and e2e import sibling apps the web image does not copy.
  typescript: { tsconfigPath: "tsconfig.build.json" },
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
