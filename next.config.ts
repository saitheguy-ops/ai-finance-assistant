import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // yahoo-finance2 is a Node-only library; keep it out of the server bundle
  // so Next loads it from node_modules at runtime.
  serverExternalPackages: ["yahoo-finance2"],
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
