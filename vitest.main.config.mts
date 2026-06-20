import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
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
    environment: "node",
    include: [
      "main/**/__tests__/**/*.test.ts",
      "main/**/*.test.ts",
      "types/**/*.test.ts",
    ],
    exclude: ["node_modules", "out", ".vite"],
    setupFiles: ["main/test/setup.ts"],
    testTimeout: 10_000,
    pool: "forks",
    coverage: {
      provider: "v8",
      include: [
        "main/modules/**/*.ts",
        "main/pollers/**/*.ts",
        "main/utils/**/*.ts",
        "types/**/*.ts",
      ],
      exclude: [
        "main/modules/**/__tests__/**",
        "main/modules/**/index.ts",
        "main/modules/**/*.api.ts",
        "main/modules/**/*.channels.ts",
        "main/modules/**/*.dto.ts",
        "main/modules/**/*.types.ts",
        "main/modules/database/Database.types.ts",
        "main/modules/database/migrations/Migration.interface.ts",
        "main/pollers/**/__tests__/**",
        "main/pollers/index.ts",
        "main/**/*.test.ts",
        "types/index.ts",
        "types/**/*.test.ts",
      ],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
