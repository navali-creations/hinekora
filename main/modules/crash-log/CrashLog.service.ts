import { readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

import { app, crashReporter } from "electron";

import {
  createSafePathLogFields,
  createTextHash,
  logError,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";

import pkgJson from "../../../package.json" with { type: "json" };

const CRASH_LOG_SCOPE = "crash-log";
const recentCrashDumpLimit = 5;

interface CrashLogInitializeOptions {
  startReporter?: boolean;
}

interface LocalCrashDumpFile {
  file: string;
  hash: string;
  modifiedAt: string;
  path: string;
}

class CrashLogService {
  private static instance: CrashLogService | null = null;
  private initialized = false;
  private processHandlersRegistered = false;
  private pathsLogged = false;

  static getInstance(): CrashLogService {
    CrashLogService.instance ??= new CrashLogService();
    return CrashLogService.instance;
  }

  static resetForTests(): void {
    CrashLogService.instance = null;
  }

  initialize(options: CrashLogInitializeOptions = {}): void {
    this.registerProcessErrorHandlers();
    this.logCrashDumpDirectory();

    if (!options.startReporter || this.initialized) {
      return;
    }

    try {
      crashReporter.start({
        uploadToServer: false,
        productName: "Hinekora",
        globalExtra: {
          appVersion: pkgJson.version,
          platform: process.platform,
          arch: process.arch,
        },
      });
      this.initialized = true;

      logInfo(CRASH_LOG_SCOPE, "Local crash reporter started", {
        uploadToServer: false,
      });
    } catch (error) {
      logWarn(CRASH_LOG_SCOPE, "Local crash reporter failed to start", {
        error: safeErrorMessage(error),
      });
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  listRecentCrashDumpFiles(): LocalCrashDumpFile[] {
    return listRecentCrashDumpFiles(app.getPath("crashDumps"));
  }

  private registerProcessErrorHandlers(): void {
    if (this.processHandlersRegistered) {
      return;
    }

    this.processHandlersRegistered = true;
    process.on("uncaughtException", (error) => {
      logError(CRASH_LOG_SCOPE, "Uncaught exception", {
        error: safeErrorMessage(error),
      });
    });
    process.on("unhandledRejection", (reason) => {
      logError(CRASH_LOG_SCOPE, "Unhandled rejection", {
        error: safeErrorMessage(reason),
      });
    });
  }

  private logCrashDumpDirectory(): void {
    if (this.pathsLogged) {
      return;
    }

    this.pathsLogged = true;
    const crashDumpDirectory = app.getPath("crashDumps");
    const recentDumps = listRecentCrashDumpFiles(crashDumpDirectory);
    logInfo(CRASH_LOG_SCOPE, "Crash dump directory ready", {
      ...createSafePathLogFields(crashDumpDirectory, "crashDumpDirectory"),
      crashDumpCount: recentDumps.length,
      latestCrashDumpFile: recentDumps[0]?.file ?? null,
      latestCrashDumpHash: recentDumps[0]?.hash ?? null,
      latestCrashDumpModifiedAt: recentDumps[0]?.modifiedAt ?? null,
    });
  }
}

function listRecentCrashDumpFiles(directory: string): LocalCrashDumpFile[] {
  return collectCrashDumpFiles(directory)
    .sort((first, second) => second.modifiedAtMs - first.modifiedAtMs)
    .slice(0, recentCrashDumpLimit)
    .map((dump) => ({
      file: basename(dump.path),
      hash: createTextHash(dump.path),
      modifiedAt: new Date(dump.modifiedAtMs).toISOString(),
      path: dump.path,
    }));
}

function collectCrashDumpFiles(
  directory: string,
): Array<{ modifiedAtMs: number; path: string }> {
  try {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectCrashDumpFiles(path);
      }

      if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".dmp") {
        return [];
      }

      const stats = statSync(path);

      return [{ modifiedAtMs: stats.mtimeMs, path }];
    });
  } catch {
    return [];
  }
}

export { CrashLogService, listRecentCrashDumpFiles };
