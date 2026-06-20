import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { EOL } from "node:os";
import { basename, dirname } from "node:path";

type LogLevel = "info" | "warn" | "error";
type LogFieldValue = boolean | number | string | null | undefined;
type LogFields = Record<string, LogFieldValue>;

let logFilePath: string | null = null;
let logWriteQueue: Promise<void> = Promise.resolve();

function writeLog(
  level: LogLevel,
  scope: string,
  message: string,
  fields: LogFields,
): void {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} ${level.toUpperCase()} [${scope}] ${message}`;
  const fieldsToLog = Object.keys(fields).length > 0 ? fields : undefined;
  const logger =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.info;

  if (fieldsToLog) {
    logger(prefix, fieldsToLog);
    writeFileLog(level, prefix, fieldsToLog);
    return;
  }

  logger(prefix);
  writeFileLog(level, prefix);
}

function writeFileLog(
  level: LogLevel,
  prefix: string,
  fields?: LogFields,
): void {
  if (!logFilePath) {
    return;
  }

  const currentLogFilePath = logFilePath;
  const line = `${prefix}${fields ? ` ${JSON.stringify(fields)}` : ""}${EOL}`;

  if (level !== "info") {
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
