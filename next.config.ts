import type { NextConfig } from "next";

// Cache Components is intentionally disabled: every page is per-user and
// request-time (see docs/DECISIONS.md, plan 00).
const nextConfig: NextConfig = {
  // PGlite (dev/e2e only) ships WASM + data files; load it from node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
