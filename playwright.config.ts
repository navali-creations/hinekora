import { defineConfig } from "@playwright/test";

import { getE2EAppBaseUrl, getE2EAppPort } from "./e2e/helpers/app-url";

const e2eAppPort = getE2EAppPort();
const e2eAppBaseUrl = getE2EAppBaseUrl();
const shouldStartE2EAppServer = !process.env.E2E_APP_BASE_URL;

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
  use: {
    baseURL: e2eAppBaseUrl,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  webServer: shouldStartE2EAppServer
    ? {
        command: `pnpm exec vite --config vite.renderer.config.mts --mode e2e --host 127.0.0.1 --port ${e2eAppPort} --strictPort`,
        url: e2eAppBaseUrl,
        timeout: 30_000,
        reuseExistingServer: process.env.E2E_REUSE_EXISTING_SERVER === "true",
        stdout: "pipe",
        stderr: "pipe",
      }
    : undefined,
});
