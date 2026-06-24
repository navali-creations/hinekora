import type { ChildProcess, SpawnOptions } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";

type SquirrelEventArgument =
  | "--squirrel-install"
  | "--squirrel-updated"
  | "--squirrel-uninstall"
  | "--squirrel-obsolete";

type SquirrelShortcutCommand = "--createShortcut" | "--removeShortcut";

type SpawnSquirrelProcess = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => Pick<ChildProcess, "unref">;

interface SquirrelStartupOptions {
  argv: readonly string[];
  execPath: string;
  exists: (path: string) => boolean;
  platform: NodeJS.Platform;
  quit: () => void;
  spawnProcess: SpawnSquirrelProcess;
}

const squirrelShortcutCommands: Record<
  SquirrelEventArgument,
  SquirrelShortcutCommand | null
> = {
  "--squirrel-install": "--createShortcut",
  "--squirrel-updated": "--createShortcut",
  "--squirrel-uninstall": "--removeShortcut",
  "--squirrel-obsolete": null,
};

function isSquirrelEventArgument(
  value: string,
): value is SquirrelEventArgument {
  return Object.hasOwn(squirrelShortcutCommands, value);
}

function resolveSquirrelUpdateExePath(
  execPath: string,
  pathExists: (path: string) => boolean,
): string | null {
  const appDirectory = dirname(execPath);
  const updateExeCandidates = [
    join(appDirectory, "Update.exe"),
    resolve(appDirectory, "..", "Update.exe"),
  ];

  return updateExeCandidates.find((candidate) => pathExists(candidate)) ?? null;
}

export function handleSquirrelStartupEvent(
  options: SquirrelStartupOptions,
): boolean {
  if (options.platform !== "win32") {
    return false;
  }

  const squirrelEventArgument = options.argv.find(isSquirrelEventArgument);
  if (!squirrelEventArgument) {
    return false;
  }

  const shortcutCommand = squirrelShortcutCommands[squirrelEventArgument];
  if (shortcutCommand) {
    const updateExePath = resolveSquirrelUpdateExePath(
      options.execPath,
      options.exists,
    );

    if (updateExePath) {
      try {
        const child = options.spawnProcess(
          updateExePath,
          [shortcutCommand, basename(options.execPath)],
          {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
          },
        );
        child.unref();
      } catch {
        // Squirrel install/update events must not continue into normal app boot.
      }
    }
  }

  options.quit();
  return true;
}
