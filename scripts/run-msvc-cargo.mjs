import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/run-msvc-cargo.mjs <cargo-args...>");
  process.exit(1);
}

const cargo = process.platform === "win32" ? "cargo.exe" : "cargo";
const command = createCargoCommand(args);
const result = spawnSync(command.executable, command.args, {
  cwd: process.cwd(),
  stdio: "inherit",
});

process.exit(result.status ?? 1);

function createCargoCommand(cargoArgs) {
  if (process.platform !== "win32") {
    return { executable: cargo, args: cargoArgs };
  }

  const vsDevCmd = findVsDevCmd();
  if (!vsDevCmd) {
    return { executable: cargo, args: cargoArgs };
  }

  const wrapper = createMsvcCargoWrapper(vsDevCmd);

  return { executable: "cmd.exe", args: ["/d", "/c", wrapper, ...cargoArgs] };
}

function findVsDevCmd() {
  const programFilesX86 =
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const vswhere = join(
    programFilesX86,
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe",
  );
  if (!existsSync(vswhere)) {
    return null;
  }

  const result = spawnSync(
    vswhere,
    [
      "-latest",
      "-products",
      "*",
      "-requires",
      "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
      "-property",
      "installationPath",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    return null;
  }

  const installationPath = result.stdout.trim();
  const vsDevCmd = join(installationPath, "Common7", "Tools", "VsDevCmd.bat");

  return existsSync(vsDevCmd) ? vsDevCmd : null;
}

function quoteCmdArg(value) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function createMsvcCargoWrapper(vsDevCmd) {
  const directory = mkdtempSync(join(tmpdir(), "hinekora-cargo-"));
  const wrapper = join(directory, "run-msvc-cargo.cmd");
  writeFileSync(
    wrapper,
    [
      "@echo off",
      `call ${quoteCmdArg(vsDevCmd)} -arch=x64 -host_arch=x64 >nul`,
      "if errorlevel 1 exit /b %errorlevel%",
      `${cargo} %*`,
      "",
    ].join("\r\n"),
  );
  process.once("exit", () => {
    rmSync(directory, { force: true, recursive: true });
  });

  return wrapper;
}
