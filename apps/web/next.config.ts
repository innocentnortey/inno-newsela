import type { NextConfig } from "next";

const nextConfig: NextConfig = { reactStrictMode: true, transpilePackages: ["@ls/config", "@ls/obs"] };

export default nextConfig;
