import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { EOL } from "node:os";
import { basename, dirname } from "node:path";
import { type InspectColor, styleText } from "node:util";

type LogLevel = "info" | "warn" | "error";
type LogFieldValue = boolean | number | string | null | undefined;
type LogFields = Record<string, LogFieldValue>;

const levelColorFormats = {
  info: "greenBright",
  warn: "yellowBright",
  error: "redBright",
} as const satisfies Record<LogLevel, InspectColor>;
const scopeColorFormats = [
  "cyanBright",
  "magentaBright",
  "blueBright",
  "greenBright",
  "yellowBright",
  "redBright",
  "whiteBright",
  "cyan",
  "magenta",
  "blue",
] as const satisfies readonly InspectColor[];
const knownScopeColorFormats: Readonly<Record<string, InspectColor>> = {
  app: "blueBright",
  "app-log": "whiteBright",
  "app-setup": "cyanBright",
  "aura-manager-overlays": "magentaBright",
  "capture-preview": "yellowBright",
  "client-log": "greenBright",
  "clip-preview-renderer": "magenta",
  "death-clips-overlay": "redBright",
  "diag-log": "cyan",
  editor: "magenta",
  "grid-lines-overlay": "blue",
  "managed-recorder": "green",
  "overlay-windows": "yellow",
  "poe-process": "red",
  "recording-controls-overlay": "white",
  sentry: "cyanBright",
  startup: "greenBright",
  updater: "magentaBright",
};

let logFilePath: string | null = null;
let logWriteQueue: Promise<void> = Promise.resolve();

function writeLog(
  level: LogLevel,
  scope: string,
  message: string,
  fields: LogFields,
  options: { sync?: boolean } = {},
): void {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} ${level.toUpperCase()} [${scope}] ${message}`;
  const consolePrefix = formatConsolePrefix(timestamp, level, scope, message);
  const fieldsToLog = Object.keys(fields).length > 0 ? fields : undefined;
  const logger =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.info;

  if (fieldsToLog) {
    logger(consolePrefix, fieldsToLog);
    writeFileLog(level, prefix, fieldsToLog, options.sync);
    return;
  }

  logger(consolePrefix);
  writeFileLog(level, prefix, undefined, options.sync);
}

function formatConsolePrefix(
  timestamp: string,
  level: LogLevel,
  scope: string,
  message: string,
): string {
  if (!shouldColorizeConsole()) {
    return `${timestamp} ${level.toUpperCase()} [${scope}] ${message}`;
  }

  const stream = level === "error" ? process.stderr : process.stdout;
  const styleOptions = { stream, validateStream: false };
  const coloredTimestamp = styleText("dim", timestamp, styleOptions);
  const coloredLevel = styleText(
    levelColorFormats[level],
    level.toUpperCase(),
    styleOptions,
  );
  const coloredScope = styleText(
    ["bold", getScopeColorFormat(scope)],
    `[${scope}]`,
    styleOptions,
  );

  return `${coloredTimestamp} ${coloredLevel} ${coloredScope} ${message}`;
}

function shouldColorizeConsole(): boolean {
  if (isTestProcess()) {
    return process.env.HINEKORA_TEST_FORCE_COLOR === "1";
  }

  const forceColor = process.env.FORCE_COLOR;
  return (
    forceColor === undefined ||
    (forceColor !== "0" && forceColor.toLowerCase() !== "false")
  );
}

function isTestProcess(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    (process.env.VITEST_WORKER_ID !== undefined &&
      process.env.VITEST_WORKER_ID !== "")
  );
}

function getScopeColorFormat(scope: string): InspectColor {
  const knownScopeColor = knownScopeColorFormats[scope];
  if (knownScopeColor) {
    return knownScopeColor;
  }

  let hash = 0;

  for (let index = 0; index < scope.length; index += 1) {
    hash = (hash * 31 + scope.charCodeAt(index)) >>> 0;
  }

  return scopeColorFormats[hash % scopeColorFormats.length] as InspectColor;
}

function writeFileLog(
  level: LogLevel,
  prefix: string,
  fields?: LogFields,
  sync = false,
): void {
  if (!logFilePath) {
    return;
  }

  const currentLogFilePath = logFilePath;
  const line = `${prefix}${fields ? ` ${JSON.stringify(fields)}` : ""}${EOL}`;

  if (sync || level !== "info") {
    writeFileLogSync(currentLogFilePath, line);
    return;
  }

  logWriteQueue = logWriteQueue
    .then(() => appendFile(currentLogFilePath, line, "utf8"))
    .catch((error) => {
      logFilePath = null;
      console.warn(
        "[app-log] File logging disabled:",
        /* v8 ignore next -- Node filesystem promise rejections are Error objects. */
        error instanceof Error ? error.message : String(error),
      );
    });
}

function writeFileLogSync(path: string, line: string): void {
  try {
    appendFileSync(path, line, "utf8");
  } catch (error) {
    logFilePath = null;
    console.warn(
      "[app-log] File logging disabled:",
      /* v8 ignore next -- Node filesystem sync failures are Error objects. */
      error instanceof Error ? error.message : String(error),
    );
  }
}

function normalizeLogFields(fields: LogFields = {}): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      typeof value === "string" && value.length > 500
        ? `${value.slice(0, 500)}...`
        : value,
    ]),
  );
}

export function logInfo(
  scope: string,
  message: string,
  fields: LogFields = {},
): void {
  writeLog("info", scope, message, normalizeLogFields(fields));
}

export function logInfoSync(
  scope: string,
  message: string,
  fields: LogFields = {},
): void {
  writeLog("info", scope, message, normalizeLogFields(fields), { sync: true });
}

export function logWarn(
  scope: string,
  message: string,
  fields: LogFields = {},
): void {
  writeLog("warn", scope, message, normalizeLogFields(fields));
}

export function logError(
  scope: string,
  message: string,
  fields: LogFields = {},
): void {
  writeLog("error", scope, message, normalizeLogFields(fields));
}

export function createSafePathLogFields(
  path: string | null | undefined,
  prefix = "path",
): LogFields {
  if (!path) {
    return {
      [`${prefix}File`]: null,
      [`${prefix}Hash`]: null,
    };
  }

  return {
    [`${prefix}File`]: basename(path),
    [`${prefix}Hash`]: createHash("sha256")
      .update(path)
      .digest("hex")
      .slice(0, 12),
  };
}

export function createTextHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function configureAppLogFile(path: string): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    logFilePath = path;
    logWriteQueue = Promise.resolve();
    writeFileSync(
      logFilePath,
      `${new Date().toISOString()} INFO [app-log] File logging started${EOL}`,
      "utf8",
    );
  } catch (error) {
    logFilePath = null;
    console.warn(
      "[app-log] File logging unavailable:",
      /* v8 ignore next -- Node filesystem setup failures are Error objects. */
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function flushAppLogFileForTests(): Promise<void> {
  return logWriteQueue;
}

export function getAppLogFilePath(): string | null {
  return logFilePath;
}

export function resetAppLogFileForTests(): void {
  logFilePath = null;
  logWriteQueue = Promise.resolve();
}
