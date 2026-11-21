import type { NextConfig } from "next";

// Cache Components is intentionally disabled: every page is per-user and
// request-time (see docs/DECISIONS.md, plan 00).
const nextConfig: NextConfig = {
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
