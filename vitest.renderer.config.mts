import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "~/main": resolve(__dirname, "./main"),
      "~/renderer": resolve(__dirname, "./renderer"),
      "~/types": resolve(__dirname, "./types"),
      "~": resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["renderer/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "out", ".vite"],
    testTimeout: 10_000,
    pool: "forks",
    coverage: {
      provider: "v8",
      include: [
        "renderer/modules/**/*.ts",
        "renderer/modules/**/*.tsx",
        "renderer/components/**/*.ts",
        "renderer/components/**/*.tsx",
        "renderer/hooks/**/*.ts",
      ],
      exclude: [
        "renderer/**/*.test.ts",
        "renderer/**/*.test.tsx",
        "renderer/**/*.test-utils.ts",
        "renderer/**/index.ts",
        "renderer/routeTree.gen.ts",
        "renderer/preload.ts",
        "renderer/vite-env.d.ts",
        "renderer/window-api.d.ts",
      ],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage-renderer",
    },
  },
});
