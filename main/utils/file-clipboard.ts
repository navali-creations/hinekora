import {
  spawnSync as defaultSpawnSync,
  type SpawnSyncOptionsWithStringEncoding,
} from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { env as currentEnv, platform as currentPlatform } from "node:process";

import { createSafePathLogFields, logWarn } from "./app-log";

interface FileClipboardResult {
  ok: boolean;
  error: string | null;
}

type SpawnSyncString = (
  command: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
) => FileClipboardSpawnResult;

interface FileClipboardSpawnResult {
  error?: Error;
  signal?: NodeJS.Signals | null;
  status: number | null;
  stderr?: string;
  stdout?: string;
}

interface FileClipboardDependencies {
  exists?: (path: string) => boolean;
  platform?: NodeJS.Platform;
  spawnSync?: SpawnSyncString;
  writeText?: (text: string) => void;
}

const windowsClipboardScript = `
Add-Type -AssemblyName System.Windows.Forms
$encodedPath = $env:HINEKORA_CLIPBOARD_FILE_B64
if ([string]::IsNullOrWhiteSpace($encodedPath)) {
  throw "Clipboard file path was not provided."
}
$filePath = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encodedPath))
$files = New-Object System.Collections.Specialized.StringCollection
[void]$files.Add($filePath)
[System.Windows.Forms.Clipboard]::SetFileDropList($files)
`;
const fileClipboardLogScope = "file-clipboard";
const maxClipboardDiagnosticLength = 500;

function createClipboardFailure(
  result: FileClipboardSpawnResult,
  resolvedPath: string,
): FileClipboardResult {
  logWarn(fileClipboardLogScope, "Windows file clipboard copy failed", {
    ...createSafePathLogFields(resolvedPath, "video"),
    error: result.error?.message ?? null,
    signal: result.signal ?? null,
    status: result.status,
    stderr: sanitizeClipboardDiagnostic(result.stderr, resolvedPath),
    stdout: sanitizeClipboardDiagnostic(result.stdout, resolvedPath),
  });

  return { ok: false, error: "Could not copy file to clipboard" };
}

function sanitizeClipboardDiagnostic(
  value: string | undefined,
  resolvedPath: string,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  /* v8 ignore next -- Path separator branch depends on the host OS. */
  const alternatePath = resolvedPath.includes("\\")
    ? resolvedPath.replace(/\\/g, "/")
    : resolvedPath.replace(/\//g, "\\");

  return trimmed
    .replaceAll(resolvedPath, "<target-file>")
    .replaceAll(alternatePath, "<target-file>")
    .slice(0, maxClipboardDiagnosticLength);
}

async function writeFallbackPathText(filePath: string): Promise<void> {
  const { clipboard } = await import("electron");
  clipboard.writeText(filePath);
}

async function copyFileToClipboard(
  filePath: string,
  dependencies: FileClipboardDependencies = {},
): Promise<FileClipboardResult> {
  const resolvedPath = resolve(filePath);
  const exists = dependencies.exists ?? existsSync;
  if (!exists(resolvedPath)) {
    return { ok: false, error: "Video file is not available" };
  }

  /* v8 ignore next -- Tests inject platform to avoid touching the host clipboard. */
  const platform = dependencies.platform ?? currentPlatform;
  if (platform === "win32") {
    /* v8 ignore next -- Tests inject spawnSync to avoid invoking PowerShell. */
    const spawnSync = dependencies.spawnSync ?? defaultSpawnSync;
    const encodedPath = Buffer.from(resolvedPath, "utf8").toString("base64");
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        windowsClipboardScript,
      ],
      {
        encoding: "utf8",
        env: {
          ...currentEnv,
          HINEKORA_CLIPBOARD_FILE_B64: encodedPath,
        },
        timeout: 5_000,
        windowsHide: true,
      },
    );

    if (result.status === 0 && !result.error) {
      return { ok: true, error: null };
    }

    return createClipboardFailure(result, resolvedPath);
  }

  try {
    if (dependencies.writeText) {
      dependencies.writeText(resolvedPath);
    } else {
      await writeFallbackPathText(resolvedPath);
    }

    return { ok: true, error: null };
  } catch (error) {
    logWarn(fileClipboardLogScope, "Fallback clipboard copy failed", {
      ...createSafePathLogFields(resolvedPath, "video"),
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return { ok: false, error: "Could not copy file to clipboard" };
  }
}

export type { FileClipboardResult };
export { copyFileToClipboard };
