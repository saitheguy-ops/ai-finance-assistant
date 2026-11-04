import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws outside a React Server environment; tests run in plain Node.
      "server-only": src("test/server-only-stub.ts"),
      "@": src(""),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
