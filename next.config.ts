import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the Pi (self-contained server.js + pruned node_modules).
  // On Vercel this is ignored in favor of the platform's own build.
  output: "standalone",

  // better-sqlite3 is a native addon — keep it external so Next doesn't try to
  // bundle the .node binary. On the Pi it is (re)installed/rebuilt for aarch64.
  serverExternalPackages: ["better-sqlite3"],

  // The dashboard is a private kiosk page; no need to expose source maps.
  productionBrowserSourceMaps: false,
};

export default nextConfig;
