import { describe, expect, it, vi } from "vitest";

import {
  type ExecFileRunner,
  findRunningProcess,
  findRunningProcesses,
  hasProcessName,
  isProcessRunning,
  listRunningProcesses,
  listWindowsProcessWindowTitles,
  parseTasklistCsvFields,
  parseTasklistCsvImageName,
  parseWindowsTasklistImageNames,
  parseWindowsTasklistVerboseWindowTitles,
  resolveProcessListCommand,
} from "../isProcessRunning";

function createExecFileRunner(
  output: string,
  error: Error | null = null,
): ExecFileRunner {
  return vi.fn((_file, _args, _options, callback) => {
    callback(error, output, "");
  });
}

describe("process detection", () => {
  it("resolves platform process list commands", () => {
    expect(resolveProcessListCommand("win32")).toEqual({
      command: "tasklist",
      args: ["/FO", "CSV", "/NH"],
    });
    expect(resolveProcessListCommand("darwin")).toEqual({
      command: "ps",
      args: ["-ax"],
    });
    expect(resolveProcessListCommand("linux")).toEqual({
      command: "ps",
      args: ["-A"],
    });
    expect(resolveProcessListCommand("freebsd")).toBeNull();
  });

  it("parses Windows tasklist CSV image names", () => {
    expect(
      parseTasklistCsvFields(
        '"PathOfExileSteam.exe","1234","Console","1","1,024 K"',
      ),
    ).toEqual(["PathOfExileSteam.exe", "1234", "Console", "1", "1,024 K"]);
    expect(
      parseTasklistCsvImageName(
        '"PathOfExileSteam.exe","1234","Console","1","1,024 K"',
      ),
    ).toBe("PathOfExileSteam.exe");
    expect(parseTasklistCsvImageName('"Quoted""Name.exe","1234"')).toBe(
      'Quoted"Name.exe',
    );
    expect(parseTasklistCsvImageName("INFO: No tasks are running")).toBeNull();
    expect(parseTasklistCsvImageName('"unterminated')).toBeNull();
    expect(
      parseWindowsTasklistImageNames(
        '"PathOfExile.exe","1"\r\nsteamwebhelper.exe',
      ),
    ).toEqual(["PathOfExile.exe"]);
    expect(
      parseWindowsTasklistVerboseWindowTitles(
        '"PathOfExileSteam.exe","64956","Console","1","4,246,860 K","Running","DESKTOP\\seb","0:01:00","Path of Exile 2"',
      ),
    ).toEqual([
      {
        processName: "PathOfExileSteam.exe",
        windowTitle: "Path of Exile 2",
      },
    ]);
    expect(
      parseWindowsTasklistVerboseWindowTitles(
        '"PathOfExileSteam.exe","64956","Console"',
      ),
    ).toEqual([]);
    expect(
      parseWindowsTasklistVerboseWindowTitles(
        '"PathOfExileSteam.exe","64956","Console","1","4,246,860 K","Running","DESKTOP\\seb","0:01:00","N/A"',
      ),
    ).toEqual([]);
  });

  it("matches exact names on Windows and process lines on Unix", () => {
    expect(
      hasProcessName(
        ["Path of Building-PoE2.exe", "PathOfExileSteam.exe"],
        "PathOfExileSteam.exe",
        "win32",
      ),
    ).toBe(true);
    expect(
      hasProcessName(
        ["Path of Building-PoE2.exe"],
        "PathOfExileSteam.exe",
        "win32",
      ),
    ).toBe(false);
    expect(
      hasProcessName(
        ["123 /Games/PathOfExileSteam.exe"],
        "pathofexile",
        "linux",
      ),
    ).toBe(true);
  });

  it("lists and finds running Windows processes with one exact tasklist scan", async () => {
    const execFileRunner = createExecFileRunner(
      '"steamwebhelper.exe","1"\r\n"PathOfExile2Steam.exe","2"',
    );

    await expect(
      listRunningProcesses({ execFileRunner, platform: "win32" }),
    ).resolves.toEqual(["steamwebhelper.exe", "PathOfExile2Steam.exe"]);
    expect(execFileRunner).toHaveBeenCalledWith(
      "tasklist",
      ["/FO", "CSV", "/NH"],
      expect.objectContaining({
        maxBuffer: 1024 * 1024,
        timeout: 5_000,
        windowsHide: true,
      }),
      expect.any(Function),
    );
    await expect(
      findRunningProcess(["PathOfExileSteam.exe", "PathOfExile2Steam.exe"], {
        execFileRunner,
        platform: "win32",
      }),
    ).resolves.toBe("PathOfExile2Steam.exe");
    await expect(
      findRunningProcesses(["PathOfExileSteam.exe", "PathOfExile2Steam.exe"], {
        execFileRunner,
        platform: "win32",
      }),
    ).resolves.toEqual(["PathOfExile2Steam.exe"]);
    await expect(
      isProcessRunning("PathOfExile2Steam.exe", {
        execFileRunner,
        platform: "win32",
      }),
    ).resolves.toBe(true);
  });

  it("lists filtered Windows process window titles", async () => {
    const execFileRunner = createExecFileRunner(
      '"PathOfExileSteam.exe","64956","Console","1","4,246,860 K","Running","DESKTOP\\seb","0:01:00","Path of Exile 2"',
    );

    await expect(
      listWindowsProcessWindowTitles("PathOfExileSteam.exe", {
        execFileRunner,
        platform: "win32",
      }),
    ).resolves.toEqual([
      {
        processName: "PathOfExileSteam.exe",
        windowTitle: "Path of Exile 2",
      },
    ]);
    expect(execFileRunner).toHaveBeenCalledWith(
      "tasklist",
      ["/FI", "IMAGENAME eq PathOfExileSteam.exe", "/V", "/FO", "CSV", "/NH"],
      expect.any(Object),
      expect.any(Function),
    );
    await expect(
      listWindowsProcessWindowTitles("PathOfExileSteam.exe", {
        execFileRunner,
        platform: "linux",
      }),
    ).resolves.toEqual([]);
  });

  it("parses Unix process list lines", async () => {
    const execFileRunner = createExecFileRunner(
      "  100 /Applications/PathOfExile.app\n  101 steam",
    );

    await expect(
      listRunningProcesses({ execFileRunner, platform: "darwin" }),
    ).resolves.toEqual(["100 /Applications/PathOfExile.app", "101 steam"]);
    await expect(
      isProcessRunning("pathofexile", {
        execFileRunner,
        platform: "darwin",
      }),
    ).resolves.toBe(true);
  });

  it("fails closed when process listing is unsupported or errors", async () => {
    await expect(
      listRunningProcesses({ platform: "freebsd" }),
    ).resolves.toEqual([]);
    await expect(
      findRunningProcess(["PathOfExile.exe"], {
        execFileRunner: createExecFileRunner("", new Error("sleep")),
        platform: "win32",
      }),
    ).resolves.toBeNull();
  });
});
