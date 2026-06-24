import { dirname, join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { handleSquirrelStartupEvent } from "./squirrel-startup";

const execPath = join("/tmp/hinekora/app-0.0.11", "hinekora.exe");
const sameDirectoryUpdateExePath = join(dirname(execPath), "Update.exe");
const parentUpdateExePath = resolve(dirname(execPath), "..", "Update.exe");

function createSquirrelOptions(argv: readonly string[]) {
  return {
    argv,
    execPath,
    exists: vi.fn((path: string) => path === parentUpdateExePath),
    platform: "win32" as NodeJS.Platform,
    quit: vi.fn(),
    spawnProcess: vi.fn(() => ({ unref: vi.fn() })),
  };
}

describe("squirrel-startup", () => {
  it.each([
    ["--squirrel-install", "--createShortcut"],
    ["--squirrel-updated", "--createShortcut"],
    ["--squirrel-uninstall", "--removeShortcut"],
  ] as const)("runs %s shortcut command and suppresses normal startup", (eventArgument, shortcutCommand) => {
    const options = createSquirrelOptions(["hinekora.exe", eventArgument]);

    expect(handleSquirrelStartupEvent(options)).toBe(true);

    expect(options.spawnProcess).toHaveBeenCalledWith(
      parentUpdateExePath,
      [shortcutCommand, "hinekora.exe"],
      {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      },
    );
    expect(
      options.spawnProcess.mock.results[0]?.value.unref,
    ).toHaveBeenCalled();
    expect(options.quit).toHaveBeenCalledTimes(1);
  });

  it("uses Update.exe beside the executable when it exists there", () => {
    const options = createSquirrelOptions([
      "hinekora.exe",
      "--squirrel-install",
    ]);
    options.exists.mockImplementation(
      (path: string) => path === sameDirectoryUpdateExePath,
    );

    expect(handleSquirrelStartupEvent(options)).toBe(true);

    expect(options.spawnProcess).toHaveBeenCalledWith(
      sameDirectoryUpdateExePath,
      ["--createShortcut", "hinekora.exe"],
      expect.any(Object),
    );
    expect(options.quit).toHaveBeenCalledTimes(1);
  });

  it("quits without shortcut work for obsolete app versions", () => {
    const options = createSquirrelOptions([
      "hinekora.exe",
      "--squirrel-obsolete",
    ]);
    options.exists.mockImplementation(() => {
      throw new Error("should not inspect Update.exe");
    });

    expect(handleSquirrelStartupEvent(options)).toBe(true);

    expect(options.spawnProcess).not.toHaveBeenCalled();
    expect(options.quit).toHaveBeenCalledTimes(1);
  });

  it("quits when Update.exe is unavailable during an install event", () => {
    const options = createSquirrelOptions([
      "hinekora.exe",
      "--squirrel-install",
    ]);

    expect(
      handleSquirrelStartupEvent({
        ...options,
        exists: () => false,
      }),
    ).toBe(true);

    expect(options.spawnProcess).not.toHaveBeenCalled();
    expect(options.quit).toHaveBeenCalledTimes(1);
  });

  it("quits even when Squirrel shortcut command launch fails", () => {
    const options = createSquirrelOptions([
      "hinekora.exe",
      "--squirrel-install",
    ]);
    options.spawnProcess.mockImplementation(() => {
      throw new Error("spawn failed");
    });

    expect(
      handleSquirrelStartupEvent({
        ...options,
        exists: (path) => path === parentUpdateExePath,
      }),
    ).toBe(true);

    expect(options.quit).toHaveBeenCalledTimes(1);
  });

  it("allows first-run launches and normal launches to boot the app", () => {
    const firstRunOptions = createSquirrelOptions([
      "hinekora.exe",
      "--squirrel-firstrun",
    ]);
    const normalOptions = createSquirrelOptions(["hinekora.exe"]);

    expect(handleSquirrelStartupEvent(firstRunOptions)).toBe(false);
    expect(handleSquirrelStartupEvent(normalOptions)).toBe(false);

    expect(firstRunOptions.quit).not.toHaveBeenCalled();
    expect(normalOptions.quit).not.toHaveBeenCalled();
  });

  it("ignores Squirrel arguments outside Windows", () => {
    const options = {
      ...createSquirrelOptions(["hinekora.exe", "--squirrel-install"]),
      platform: "linux" as NodeJS.Platform,
    };

    expect(handleSquirrelStartupEvent(options)).toBe(false);

    expect(options.spawnProcess).not.toHaveBeenCalled();
    expect(options.quit).not.toHaveBeenCalled();
  });
});
