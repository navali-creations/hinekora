import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const helperDir = resolve(rootDir, "helpers/poe-process-helper");
const manifestPath = resolve(helperDir, "Cargo.toml");
const runCargoScript = resolve(scriptDir, "run-msvc-cargo.mjs");
const executableName =
  process.platform === "win32"
    ? "hinekora-poe-process-helper.exe"
    : "hinekora-poe-process-helper";
const builtExecutablePath = resolve(
  helperDir,
  "target/release",
  executableName,
);
const packagedHelperDir = resolve(rootDir, "helpers/bin/poe-process-helper");
const packagedExecutablePath = resolve(packagedHelperDir, executableName);

const result = spawnSync(
  process.execPath,
  [
    runCargoScript,
    "build",
    "--release",
    "--locked",
    "--manifest-path",
    manifestPath,
  ],
  {
    cwd: rootDir,
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

mkdirSync(packagedHelperDir, { recursive: true });
try {
  copyFileSync(builtExecutablePath, packagedExecutablePath);
} catch (error) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "EBUSY" || error.code === "EPERM")
  ) {
    console.error(
      `Could not replace ${packagedExecutablePath}. Stop Hinekora or hinekora-poe-process-helper.exe and retry.`,
    );
    process.exit(1);
  }

  throw error;
}
console.log(`Copied PoE process helper to ${packagedExecutablePath}`);
