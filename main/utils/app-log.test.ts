import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configureAppLogFile,
  createSafePathLogFields,
  createTextHash,
  flushAppLogFileForTests,
  getAppLogFilePath,
  logError,
  logInfo,
  logInfoSync,
  logWarn,
  resetAppLogFileForTests,
} from "./app-log";

describe("app-log", () => {
  afterEach(() => {
    resetAppLogFileForTests();
    vi.restoreAllMocks();
  });

  it("logs messages without fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logInfo("startup", "App ready");

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("INFO [startup] App ready"),
    );
  });

  it("truncates very large string fields before logging", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logInfo("startup", "Large field", { value: "x".repeat(501) });

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("INFO [startup] Large field"),
      { value: `${"x".repeat(500)}...` },
    );
  });

  it("creates safe path fields for empty and concrete paths", () => {
    expect(createSafePathLogFields(null, "clientLog")).toEqual({
      clientLogFile: null,
      clientLogHash: null,
    });
    expect(
      createSafePathLogFields("C:/Games/Path of Exile/Client.txt"),
    ).toEqual({
      pathFile: "Client.txt",
      pathHash: createTextHash("C:/Games/Path of Exile/Client.txt"),
    });
  });

  it("writes log lines to the configured file", async () => {
    const directory = mkdtempSync(join(tmpdir(), "hinekora-log-"));
    const logPath = join(directory, "main.log");
    writeFileSync(logPath, "stale previous run");
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    configureAppLogFile(logPath);
    logInfo("startup", "Persisted", { value: "ok" });
    await flushAppLogFileForTests();

    const contents = readFileSync(logPath, "utf8");
    expect(contents).not.toContain("stale previous run");
    expect(contents).toContain("INFO [app-log] File logging started");
    expect(contents).toContain('INFO [startup] Persisted {"value":"ok"}');

    rmSync(directory, { force: true, recursive: true });
  });

  it("writes warning and error logs synchronously", () => {
    const directory = mkdtempSync(join(tmpdir(), "hinekora-log-"));
    const logPath = join(directory, "main.log");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    configureAppLogFile(logPath);
    logWarn("startup", "Warning", { value: "warn" });
    logError("startup", "Error", { value: "error" });

    const contents = readFileSync(logPath, "utf8");
    expect(contents).toContain('WARN [startup] Warning {"value":"warn"}');
    expect(contents).toContain('ERROR [startup] Error {"value":"error"}');

    rmSync(directory, { force: true, recursive: true });
  });

  it("can write info logs synchronously for native crash boundaries", () => {
    const directory = mkdtempSync(join(tmpdir(), "hinekora-log-"));
    const logPath = join(directory, "main.log");
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    configureAppLogFile(logPath);
    logInfoSync("native", "Before native call", { value: "checkpoint" });

    const contents = readFileSync(logPath, "utf8");
    expect(contents).toContain(
      'INFO [native] Before native call {"value":"checkpoint"}',
    );

    rmSync(directory, { force: true, recursive: true });
  });

  it("disables file logging when async or sync writes fail", async () => {
    const asyncDirectory = mkdtempSync(join(tmpdir(), "hinekora-log-"));
    const asyncPath = join(asyncDirectory, "main.log");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    configureAppLogFile(asyncPath);
    rmSync(asyncDirectory, { force: true, recursive: true });

    logInfo("startup", "Async write");
    await flushAppLogFileForTests();

    expect(getAppLogFilePath()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "[app-log] File logging disabled:",
      expect.any(String),
    );

    const syncDirectory = mkdtempSync(join(tmpdir(), "hinekora-log-"));
    const syncPath = join(syncDirectory, "main.log");
    configureAppLogFile(syncPath);
    rmSync(syncDirectory, { force: true, recursive: true });

    logWarn("startup", "Sync write");

    expect(getAppLogFilePath()).toBeNull();
  });

  it("leaves file logging disabled when the log file cannot be created", () => {
    const directory = mkdtempSync(join(tmpdir(), "hinekora-log-"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    configureAppLogFile(directory);

    expect(getAppLogFilePath()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "[app-log] File logging unavailable:",
      expect.any(String),
    );

    rmSync(directory, { force: true, recursive: true });
  });
});
