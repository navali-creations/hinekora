import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  appHandlers: new Map<string, Set<(...args: unknown[]) => void>>(),
  appOff: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
    electronMocks.appHandlers.get(event)?.delete(listener);
  }),
  appOn: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
    const listeners = electronMocks.appHandlers.get(event) ?? new Set();
    listeners.add(listener);
    electronMocks.appHandlers.set(event, listeners);
  }),
  crashReporterStart: vi.fn(),
  getPath: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: electronMocks.getPath,
    off: electronMocks.appOff,
    on: electronMocks.appOn,
  },
  crashReporter: {
    start: electronMocks.crashReporterStart,
  },
  ipcMain: {
    handle: vi.fn(),
  },
  shell: {
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

import {
  configureAppLogFile,
  resetAppLogFileForTests,
} from "~/main/utils/app-log";
import { setIpcMainHandleForTests } from "~/main/utils/ipc-window-roles";

import { DiagLogChannel } from "../DiagLog.channels";
import {
  DiagLogService,
  listRecentCrashDumpFiles,
  resolveDiagnosticLogPath,
} from "../DiagLog.service";

describe("DiagLogService", () => {
  let directory: string;

  beforeEach(() => {
    DiagLogService.resetForTests();
    electronMocks.appHandlers.clear();
    vi.clearAllMocks();
    directory = mkdtempSync(join(tmpdir(), "hinekora-diag-service-"));
    electronMocks.getPath.mockImplementation((name: string) => {
      if (name === "crashDumps" || name === "logs" || name === "userData") {
        return directory;
      }

      return tmpdir();
    });
    resetAppLogFileForTests();
  });

  afterEach(() => {
    DiagLogService.resetForTests();
    resetAppLogFileForTests();
    setIpcMainHandleForTests(null);
    rmSync(directory, { force: true, recursive: true });
  });

  it("registers a guarded IPC handler that reveals the configured app log", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const logPath = join(directory, "main.log");
    configureAppLogFile(logPath);
    setIpcMainHandleForTests((channel, listener) => {
      handlers.set(channel, listener as (...args: unknown[]) => unknown);
    });

    DiagLogService.getInstance();
    const handler = handlers.get(DiagLogChannel.RevealLogFile);
    const result = await handler?.({});

    expect(result).toEqual({ success: true });
    expect(electronMocks.showItemInFolder).toHaveBeenCalledWith(logPath);
  });

  it("falls back to the default logs directory when app logging is not configured", () => {
    expect(resolveDiagnosticLogPath()).toBe(join(directory, "main.log"));
  });

  it("returns safe errors when revealing the diagnostic log fails", () => {
    electronMocks.showItemInFolder.mockImplementationOnce(() => {
      throw new Error("shell failed");
    });
    configureAppLogFile(join(directory, "main.log"));
    const service = DiagLogService.getInstance();

    expect(service.revealLogFile()).toEqual({
      success: false,
      error: "shell failed",
    });
  });

  it("starts local crash reporting without uploads when requested", () => {
    const service = DiagLogService.getInstance();

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
    const service = DiagLogService.getInstance();

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
    const service = DiagLogService.getInstance();

    service.initialize({ startReporter: false });

    expect(service.isInitialized()).toBe(false);
    expect(electronMocks.crashReporterStart).not.toHaveBeenCalled();
    expect(electronMocks.appOn).toHaveBeenCalledWith(
      "render-process-gone",
      expect.any(Function),
    );
    expect(electronMocks.appOn).toHaveBeenCalledWith(
      "child-process-gone",
      expect.any(Function),
    );
  });

  it("logs process lifecycle events synchronously", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    DiagLogService.getInstance().initialize({ startReporter: false });
    const beforeExitHandler = process.listeners("beforeExit").at(-1) as
      | ((code: number) => void)
      | undefined;
    const exitHandler = process.listeners("exit").at(-1) as
      | ((code: number) => void)
      | undefined;

    beforeExitHandler?.(11);
    exitHandler?.(12);

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("INFO [diag-log] Main process beforeExit"),
      expect.objectContaining({ code: 11 }),
    );
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("INFO [diag-log] Main process exit"),
      expect.objectContaining({ code: 12 }),
    );
  });

  it("records an unclean run marker and reports it on the next launch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const runStatePath = join(directory, "last-run.json");
    writeFileSync(
      runStatePath,
      JSON.stringify({
        clean: false,
        pid: 123,
        exitedAt: "2026-06-20T12:05:00.000Z",
        startedAt: "2026-06-20T12:00:00.000Z",
        version: "0.0.0",
      }),
    );

    DiagLogService.getInstance().initialize({ startReporter: false });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "WARN [diag-log] Previous app run did not shut down cleanly",
      ),
      expect.objectContaining({
        previousPid: 123,
        previousStartedAt: "2026-06-20T12:00:00.000Z",
        previousVersion: "0.0.0",
      }),
    );
    expect(JSON.parse(readFileSync(runStatePath, "utf8"))).toMatchObject({
      clean: false,
      pid: process.pid,
    });
  });

  it("ignores invalid previous run markers", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const runStatePath = join(directory, "last-run.json");

    writeFileSync(
      runStatePath,
      JSON.stringify({
        clean: true,
        pid: 123,
        startedAt: "2026-06-20T12:00:00.000Z",
        version: "0.0.0",
      }),
    );
    DiagLogService.getInstance().initialize({ startReporter: false });
    expect(warn).not.toHaveBeenCalled();

    DiagLogService.resetForTests();
    warn.mockClear();
    writeFileSync(runStatePath, JSON.stringify({ clean: false }));
    DiagLogService.getInstance().initialize({ startReporter: false });
    expect(warn).not.toHaveBeenCalled();

    DiagLogService.resetForTests();
    warn.mockClear();
    writeFileSync(runStatePath, "{not-json");
    DiagLogService.getInstance().initialize({ startReporter: false });

    expect(warn).not.toHaveBeenCalled();
  });

  it("marks the run clean when Electron is about to quit", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const runStatePath = join(directory, "last-run.json");
    DiagLogService.getInstance().initialize({ startReporter: false });

    emitAppEvent("will-quit", {});

    expect(JSON.parse(readFileSync(runStatePath, "utf8"))).toMatchObject({
      clean: true,
      pid: process.pid,
    });
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("INFO [diag-log] App run marked clean"),
    );
  });

  it("marks the run clean when no startup timestamp has been recorded yet", () => {
    const runStatePath = join(directory, "last-run.json");
    const service = DiagLogService.getInstance() as unknown as {
      handleAppWillQuit(): void;
    };

    service.handleAppWillQuit();

    expect(JSON.parse(readFileSync(runStatePath, "utf8"))).toMatchObject({
      clean: true,
      pid: process.pid,
      startedAt: expect.any(String),
    });
  });

  it("logs clean renderer and child process exits as informational diagnostics", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    DiagLogService.getInstance().initialize({ startReporter: false });

    emitAppEvent(
      "render-process-gone",
      {},
      {
        getType: () => "window",
        getURL: () => "not-a-url",
        id: 8,
      },
      { exitCode: 0, reason: "clean-exit" },
    );
    emitAppEvent(
      "render-process-gone",
      {},
      {
        getType: () => "window",
        getURL: () => {
          throw new Error("unavailable");
        },
        id: 9,
      },
      { exitCode: 0, reason: "clean-exit" },
    );
    emitAppEvent(
      "child-process-gone",
      {},
      {
        exitCode: 0,
        reason: "clean-exit",
        type: "Utility",
      },
    );

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("INFO [diag-log] Renderer process exited"),
      expect.objectContaining({
        exitCode: 0,
        reason: "clean-exit",
        urlHash: expect.any(String),
        urlScheme: null,
        webContentsId: 8,
      }),
    );
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("INFO [diag-log] Renderer process exited"),
      expect.objectContaining({
        urlHash: null,
        urlScheme: null,
        webContentsId: 9,
      }),
    );
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("INFO [diag-log] Child process exited"),
      expect.objectContaining({
        name: null,
        serviceName: null,
        type: "Utility",
      }),
    );
  });

  it("logs renderer and child process crashes", () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    DiagLogService.getInstance().initialize({ startReporter: false });

    emitAppEvent(
      "render-process-gone",
      {},
      {
        getType: () => "window",
        getURL: () => "hinekora-media://replay-clip/clip-1",
        id: 7,
      },
      { exitCode: 9, reason: "crashed" },
    );
    emitAppEvent(
      "child-process-gone",
      {},
      {
        exitCode: 3,
        name: "Video Capture",
        reason: "oom",
        serviceName: "video.mojom.VideoCaptureService",
        type: "Utility",
      },
    );

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("ERROR [diag-log] Renderer process gone"),
      expect.objectContaining({
        exitCode: 9,
        reason: "crashed",
        urlScheme: "hinekora-media",
        webContentsId: 7,
        webContentsType: "window",
      }),
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("ERROR [diag-log] Child process gone"),
      expect.objectContaining({
        exitCode: 3,
        name: "Video Capture",
        reason: "oom",
        serviceName: "video.mojom.VideoCaptureService",
        type: "Utility",
      }),
    );
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
    expect(dumps[0]).not.toHaveProperty("path");
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
    expect(DiagLogService.getInstance().listRecentCrashDumpFiles()).toEqual([
      expect.objectContaining({ file: "nested.dmp" }),
    ]);
  });
});

function emitAppEvent(event: string, ...args: unknown[]): void {
  for (const listener of electronMocks.appHandlers.get(event) ?? []) {
    listener(...args);
  }
}
