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

const ansiEscapePatternSource = `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`;
const ansiEscapePattern = new RegExp(ansiEscapePatternSource, "g");

function stripAnsi(value: string): string {
  return value.replace(ansiEscapePattern, "");
}

function readFirstConsoleArgument(
  calls: ReadonlyArray<ReadonlyArray<unknown>>,
) {
  const value = calls[0]?.[0];
  if (typeof value !== "string") {
    throw new Error("Expected first console argument to be a string");
  }

  return value;
}

function readScopeColorSequence(value: string, scope: string): string {
  const match = value.match(
    new RegExp(`((?:${ansiEscapePatternSource})+)\\[${scope}\\]`),
  );
  if (!match?.[1]) {
    throw new Error(`Expected ${scope} scope to be colorized`);
  }

  return match[1];
}

function stubNonTestProcess(): void {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VITEST", "false");
  vi.stubEnv("VITEST_WORKER_ID", "");
}

describe("app-log", () => {
  afterEach(() => {
    resetAppLogFileForTests();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs messages without fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logInfo("startup", "App ready");

    expect(stripAnsi(readFirstConsoleArgument(info.mock.calls))).toContain(
      "INFO [startup] App ready",
    );
  });

  it("truncates very large string fields before logging", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logInfo("startup", "Large field", { value: "x".repeat(501) });

    expect(stripAnsi(readFirstConsoleArgument(info.mock.calls))).toContain(
      "INFO [startup] Large field",
    );
    expect(info).toHaveBeenCalledWith(expect.any(String), {
      value: `${"x".repeat(500)}...`,
    });
  });

  it("colors console level and scope prefixes with native Node styles", () => {
    vi.stubEnv("HINEKORA_TEST_FORCE_COLOR", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logInfo("startup", "App ready");
    logInfo("sentry", "Initialized");

    const startupLog = readFirstConsoleArgument([info.mock.calls[0] ?? []]);
    const sentryLog = readFirstConsoleArgument([info.mock.calls[1] ?? []]);

    expect(startupLog).toContain("\u001b[");
    expect(stripAnsi(startupLog)).toContain("INFO [startup] App ready");
    expect(stripAnsi(sentryLog)).toContain("INFO [sentry] Initialized");
    expect(readScopeColorSequence(startupLog, "startup")).not.toBe(
      readScopeColorSequence(sentryLog, "sentry"),
    );
  });

  it("uses explicit colors for known log scopes before hash fallback", () => {
    vi.stubEnv("HINEKORA_TEST_FORCE_COLOR", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logInfo("managed-recorder", "Recorder ready");
    logInfo("overlay-windows", "Overlay ready");

    const recorderLog = readFirstConsoleArgument([info.mock.calls[0] ?? []]);
    const overlayLog = readFirstConsoleArgument([info.mock.calls[1] ?? []]);

    expect(stripAnsi(recorderLog)).toContain(
      "INFO [managed-recorder] Recorder ready",
    );
    expect(stripAnsi(overlayLog)).toContain(
      "INFO [overlay-windows] Overlay ready",
    );
    expect(readScopeColorSequence(recorderLog, "managed-recorder")).not.toBe(
      readScopeColorSequence(overlayLog, "overlay-windows"),
    );
  });

  it("uses hashed colors for unknown log scopes", () => {
    vi.stubEnv("HINEKORA_TEST_FORCE_COLOR", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logInfo("unknown-main-scope", "Fallback color");

    const fallbackLog = readFirstConsoleArgument(info.mock.calls);
    expect(stripAnsi(fallbackLog)).toContain(
      "INFO [unknown-main-scope] Fallback color",
    );
    expect(readScopeColorSequence(fallbackLog, "unknown-main-scope")).toContain(
      "\u001b[",
    );
  });

  it("colorizes error logs against stderr", () => {
    vi.stubEnv("HINEKORA_TEST_FORCE_COLOR", "1");
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    logError("startup", "Failed");

    const errorLog = readFirstConsoleArgument(error.mock.calls);
    expect(errorLog).toContain("\u001b[");
    expect(stripAnsi(errorLog)).toContain("ERROR [startup] Failed");
  });

  it("honors FORCE_COLOR outside test processes", () => {
    stubNonTestProcess();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    vi.stubEnv("FORCE_COLOR", undefined);
    logInfo("startup", "Default color");
    expect(stripAnsi(readFirstConsoleArgument(info.mock.calls))).toContain(
      "INFO [startup] Default color",
    );

    info.mockClear();
    vi.stubEnv("FORCE_COLOR", "0");
    logInfo("startup", "Disabled color");
    expect(readFirstConsoleArgument(info.mock.calls)).not.toContain("\u001b[");

    info.mockClear();
    vi.stubEnv("FORCE_COLOR", "false");
    logInfo("startup", "False color");
    expect(readFirstConsoleArgument(info.mock.calls)).not.toContain("\u001b[");

    info.mockClear();
    vi.stubEnv("FORCE_COLOR", "1");
    logInfo("startup", "Forced color");
    expect(readFirstConsoleArgument(info.mock.calls)).toContain("\u001b[");
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
