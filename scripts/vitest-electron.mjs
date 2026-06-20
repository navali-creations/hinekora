#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");
const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const vitestEntry = resolve(
  projectRoot,
  "node_modules",
  "vitest",
  "vitest.mjs",
);

const child = spawn(electronBinary, [vitestEntry, ...process.argv.slice(2)], {
  stdio: "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
  },
});

child.on("close", (code, signal) => {
  if (code !== null) {
    process.exit(code);
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}
