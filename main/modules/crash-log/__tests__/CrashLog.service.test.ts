import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  crashReporterStart: vi.fn(),
  getPath: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: electronMocks.getPath,
  },
  crashReporter: {
    start: electronMocks.crashReporterStart,
  },
}));

import { CrashLogService, listRecentCrashDumpFiles } from "../CrashLog.service";

describe("CrashLogService", () => {
  let directory: string;

  beforeEach(() => {
    vi.clearAllMocks();
    CrashLogService.resetForTests();
    directory = mkdtempSync(join(tmpdir(), "hinekora-crashes-"));
    electronMocks.getPath.mockImplementation((name: string) => {
      if (name === "crashDumps") {
        return directory;
      }

      return tmpdir();
    });
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("starts local crash reporting without uploads when requested", () => {
    const service = CrashLogService.getInstance();

    service.initialize({ startReporter: true });

    expect(service.isInitialized()).toBe(true);
    expect(electronMocks.crashReporterStart).toHaveBeenCalledWith(
      expect.objectContaining({
        productName: "Hinekora",
        uploadToServer: false,
      }),
    );
  });

  it("logs reporter startup failures and only registers process diagnostics once", () => {
    electronMocks.crashReporterStart.mockImplementationOnce(() => {
      throw new Error("start failed");
    });
    const service = CrashLogService.getInstance();

    service.initialize({ startReporter: true });
    service.initialize({ startReporter: true });
    const uncaughtExceptionHandler = process
      .listeners("uncaughtException")
      .at(-1) as ((error: Error, origin: string) => void) | undefined;
    const unhandledRejectionHandler = process
      .listeners("unhandledRejection")
      .at(-1) as
      | ((reason: unknown, promise: Promise<unknown>) => void)
      | undefined;
    uncaughtExceptionHandler?.(new Error("boom"), "uncaughtException");
    unhandledRejectionHandler?.(new Error("rejected"), Promise.resolve());

    expect(service.isInitialized()).toBe(true);
    expect(electronMocks.crashReporterStart).toHaveBeenCalledTimes(2);
  });

  it("can register diagnostics without starting the crash reporter", () => {
    const service = CrashLogService.getInstance();

    service.initialize({ startReporter: false });

    expect(service.isInitialized()).toBe(false);
    expect(electronMocks.crashReporterStart).not.toHaveBeenCalled();
  });

  it("lists recent local minidumps newest first", () => {
    const olderDump = join(directory, "older.dmp");
    const newerDump = join(directory, "newer.dmp");
    writeFileSync(olderDump, "older");
    writeFileSync(newerDump, "newer");
    utimesSync(
      olderDump,
      new Date("2026-06-19T00:00:00.000Z"),
      new Date("2026-06-19T00:00:00.000Z"),
    );
    utimesSync(
      newerDump,
      new Date("2026-06-19T00:01:00.000Z"),
      new Date("2026-06-19T00:01:00.000Z"),
    );

    const dumps = listRecentCrashDumpFiles(directory);

    expect(dumps).toEqual([
      expect.objectContaining({ file: "newer.dmp" }),
      expect.objectContaining({ file: "older.dmp" }),
    ]);
  });

  it("lists nested minidumps and ignores non-dump entries", () => {
    const nestedDirectory = join(directory, "nested");
    mkdirSync(nestedDirectory, { recursive: true });
    writeFileSync(join(directory, "notes.txt"), "ignore");
    writeFileSync(join(nestedDirectory, "nested.dmp"), "dump");

    expect(listRecentCrashDumpFiles(directory)).toEqual([
      expect.objectContaining({ file: "nested.dmp" }),
    ]);
    expect(listRecentCrashDumpFiles(join(directory, "missing"))).toEqual([]);
    expect(CrashLogService.getInstance().listRecentCrashDumpFiles()).toEqual([
      expect.objectContaining({ file: "nested.dmp" }),
    ]);
  });
});
