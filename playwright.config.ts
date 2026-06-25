import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.test.ts",
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 3,
  fullyParallel: false,
  reportSlowTests: { max: 0, threshold: 0 },
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "never" }], ["list"]],
  outputDir: "./e2e/test-results",
  use: { screenshot: "off", trace: "off", video: "off" },
  webServer: {
    command: "pnpm exec vite --config vite.renderer.config.mts --port 5173",
    port: 5173,
    timeout: 30_000,
    reuseExistingServer: true,
    stdout: "pipe",
    stderr: "pipe",
  },
});
