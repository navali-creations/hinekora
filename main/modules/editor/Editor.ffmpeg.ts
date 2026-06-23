import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  createSafePathLogFields,
  logInfo,
  logWarn,
} from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";

import type { EditorExportResolution } from "./Editor.dto";
import {
  calculateEditorExportDuration,
  createEditorExportFilterScript,
  type EditorExportRenderSegment,
  type EditorExportSegment,
} from "./Editor.export";

const editorExportFfmpegTimeoutMs = 30 * 60 * 1_000;
const editorExportFfprobeTimeoutMs = 15_000;
const editorAudioProbeConcurrency = 4;
const editorLogScope = "editor";
const currentDir = __dirname;

async function renderEditorExportWithFfmpeg(input: {
  onProgress?: (progress: number) => void;
  outputPath: string;
  resolution: EditorExportResolution;
  segments: EditorExportSegment[];
}): Promise<void> {
  const ffmpegPath = resolveEditorFfmpegPath();
  logEditorBinaryResolution("ffmpeg", ffmpegPath);
  /* v8 ignore next -- Depends on packaged binary availability, not business logic. */
  if (!ffmpegPath) {
    throw new Error("Bundled ffmpeg is not available");
  }
  const ffprobePath = resolveEditorFfprobePath();
  logEditorBinaryResolution("ffprobe", ffprobePath);
  /* v8 ignore next -- Depends on packaged binary availability, not business logic. */
  if (!ffprobePath) {
    logWarn(editorLogScope, "Bundled ffprobe is not available", {
      binary: "ffprobe",
    });
  }

  const renderSegments = await createRenderSegments(
    input.segments,
    ffprobePath,
  );
  const filterScriptPath = await createExportFilterScript(
    input.resolution,
    renderSegments,
    input.outputPath,
  );
  logInfo(editorLogScope, "Editor ffmpeg render prepared", {
    audioClipSegmentCount: renderSegments.filter(
      (segment) => segment.kind === "clip" && segment.hasAudio,
    ).length,
    clipSegmentCount: renderSegments.filter(
      (segment) => segment.kind === "clip",
    ).length,
    gapSegmentCount: renderSegments.filter((segment) => segment.kind === "gap")
      .length,
    resolution: input.resolution,
    segmentCount: renderSegments.length,
    ...createSafePathLogFields(filterScriptPath, "filterScript"),
    ...createSafePathLogFields(input.outputPath, "export"),
  });

  const ffmpegDependencies: {
    onProgress?: (progress: number) => void;
    progressDurationSeconds: number;
  } = {
    progressDurationSeconds: calculateEditorExportDuration(input.segments),
  };
  if (input.onProgress) {
    ffmpegDependencies.onProgress = input.onProgress;
  }

  try {
    logInfo(editorLogScope, "Editor ffmpeg render started", {
      inputCount: renderSegments.filter((segment) => segment.kind === "clip")
        .length,
      resolution: input.resolution,
      ...createSafePathLogFields(ffmpegPath, "ffmpeg"),
      ...createSafePathLogFields(input.outputPath, "export"),
    });
    await runEditorFfmpeg(
      ffmpegPath,
      [
        "-hide_banner",
        "-y",
        "-fflags",
        "+genpts",
        ...renderSegments.flatMap((segment) =>
          segment.kind === "clip"
            ? [
                "-ss",
                formatFfmpegSeconds(segment.inSeconds),
                "-t",
                formatFfmpegSeconds(segment.durationSeconds),
                "-i",
                segment.source.path,
              ]
            : [],
        ),
        "-filter_complex_script",
        filterScriptPath,
        "-map",
        "[outv]",
        "-map",
        "[outa]",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        input.resolution === "720p" ? "23" : "21",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        input.outputPath,
      ],
      ffmpegDependencies,
    );
    logInfo(editorLogScope, "Editor ffmpeg render completed", {
      resolution: input.resolution,
      ...createSafePathLogFields(input.outputPath, "export"),
    });
  } finally {
    await rm(filterScriptPath, { force: true });
  }
}

function resolveEditorFfmpegPath(): string | null {
  return resolveNoobsBinaryPath("ffmpeg");
}

function resolveEditorFfprobePath(): string | null {
  return resolveNoobsBinaryPath("ffprobe");
}

function runEditorFfmpeg(
  ffmpegPath: string,
  args: string[],
  dependencies: {
    onProgress?: (progress: number) => void;
    progressDurationSeconds?: number;
    spawnProcess?: typeof spawn;
    timeoutMs?: number;
  } = {},
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const spawnProcess = dependencies.spawnProcess ?? spawn;
    const child = spawnProcess(ffmpegPath, args, {
      windowsHide: true,
    });
    const stderrChunks: Buffer[] = [];
    const progressInput: {
      durationSeconds?: number;
      onProgress?: (progress: number) => void;
    } = {};
    if (dependencies.progressDurationSeconds !== undefined) {
      progressInput.durationSeconds = dependencies.progressDurationSeconds;
    }
    if (dependencies.onProgress) {
      progressInput.onProgress = dependencies.onProgress;
    }
    const reportProgress = createFfmpegProgressReporter(progressInput);
    let didTimeout = false;
    let isSettled = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      child.kill("SIGKILL");
    }, dependencies.timeoutMs ?? editorExportFfmpegTimeoutMs);

    const settle = (work: () => void) => {
      /* v8 ignore next -- Duplicate child-process events after settlement are defensive. */
      if (isSettled) {
        return;
      }

      isSettled = true;
      clearTimeout(timeoutId);
      work();
    };

    /* v8 ignore start -- Electron fork coverage does not attribute EventEmitter data callbacks reliably. */
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      reportProgress(chunk);
    });
    /* v8 ignore stop */
    child.on("error", (error) => {
      settle(() => reject(error));
    });
    child.on("close", (code) => {
      if (didTimeout) {
        settle(() => reject(new Error("ffmpeg export timed out")));
        return;
      }

      if (code === 0) {
        dependencies.onProgress?.(1);
        settle(resolvePromise);
        return;
      }

      const stderr = Buffer.concat(stderrChunks)
        .toString("utf8")
        .slice(-1_500)
        .trim();
      settle(() =>
        reject(
          new Error(
            stderr
              ? `ffmpeg export failed: ${stderr}`
              : `ffmpeg export failed with code ${code ?? "unknown"}`,
          ),
        ),
      );
    });
  });
}

function createFfmpegProgressReporter(input: {
  durationSeconds?: number;
  onProgress?: (progress: number) => void;
}): (chunk: Buffer) => void {
  let progressBuffer = "";
  const durationSeconds = input.durationSeconds;
  if (!input.onProgress || !durationSeconds || durationSeconds <= 0) {
    return () => undefined;
  }

  return (chunk: Buffer) => {
    progressBuffer = `${progressBuffer}${chunk.toString("utf8")}`.slice(-2_000);
    const progressSeconds = parseFfmpegProgressSeconds(progressBuffer);
    if (progressSeconds === null) {
      return;
    }

    input.onProgress?.(
      Math.min(Math.max(progressSeconds / durationSeconds, 0), 0.98),
    );
  };
}

function parseFfmpegProgressSeconds(output: string): number | null {
  const matches = Array.from(
    output.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g),
  );
  const match = matches.at(-1);
  if (!match) {
    return null;
  }

  const [, hours, minutes, seconds] = match;
  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);
  const parsedSeconds = Number(seconds);
  return parsedHours * 3_600 + parsedMinutes * 60 + parsedSeconds;
}

async function createExportFilterScript(
  resolution: EditorExportResolution,
  segments: EditorExportRenderSegment[],
  outputPath: string,
): Promise<string> {
  const scriptPath = join(
    dirname(outputPath),
    `.hinekora-export-filter-${randomUUID()}.txt`,
  );

  await writeFile(
    scriptPath,
    createEditorExportFilterScript({
      resolution,
      segments,
    }),
    "utf8",
  );

  return scriptPath;
}

async function createRenderSegments(
  segments: EditorExportSegment[],
  ffprobePath: string | null,
): Promise<EditorExportRenderSegment[]> {
  let inputIndex = 0;
  const audioStreamsByPath = ffprobePath
    ? await resolveAudioStreamsByPath({
        ffprobePath,
        paths: collectClipSourcePaths(segments),
      })
    : new Map<string, boolean>();
  const renderSegments: EditorExportRenderSegment[] = [];

  for (const segment of segments) {
    if (segment.kind === "gap") {
      renderSegments.push(segment);
      continue;
    }

    const hasAudio = audioStreamsByPath.get(segment.source.path) ?? false;

    renderSegments.push({
      ...segment,
      hasAudio,
      inputIndex,
    });
    inputIndex += 1;
  }

  return renderSegments;
}

function collectClipSourcePaths(segments: EditorExportSegment[]): string[] {
  return Array.from(
    new Set(
      segments.flatMap((segment) =>
        segment.kind === "clip" ? [segment.source.path] : [],
      ),
    ),
  );
}

async function resolveAudioStreamsByPath(input: {
  concurrency?: number;
  ffprobePath: string;
  paths: string[];
  probe?: typeof probeEditorAudioStream;
}): Promise<Map<string, boolean>> {
  const uniquePaths = Array.from(new Set(input.paths));
  if (uniquePaths.length === 0) {
    return new Map();
  }

  const probe = input.probe ?? probeEditorAudioStream;
  const results = new Map<string, boolean>();
  const workerCount = Math.min(
    Math.max(1, Math.floor(input.concurrency ?? editorAudioProbeConcurrency)),
    uniquePaths.length,
  );
  logInfo(editorLogScope, "Audio stream probe batch started", {
    sourceCount: uniquePaths.length,
    workerCount,
    ...createSafePathLogFields(input.ffprobePath, "ffprobe"),
  });
  let nextIndex = 0;

  const probeNextPath = async () => {
    while (nextIndex < uniquePaths.length) {
      const path = uniquePaths[nextIndex]!;
      nextIndex += 1;
      results.set(
        path,
        await probe({
          ffprobePath: input.ffprobePath,
          path,
        }),
      );
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => probeNextPath()));

  logInfo(editorLogScope, "Audio stream probe batch completed", {
    audioSourceCount: Array.from(results.values()).filter(Boolean).length,
    sourceCount: uniquePaths.length,
  });

  return new Map(uniquePaths.map((path) => [path, results.get(path)!]));
}

function probeEditorAudioStream(input: {
  ffprobePath: string;
  path: string;
  spawnProcess?: typeof spawn;
  timeoutMs?: number;
}): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const spawnProcess = input.spawnProcess ?? spawn;
    const child = spawnProcess(
      input.ffprobePath,
      [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=index",
        "-of",
        "csv=p=0",
        input.path,
      ],
      { windowsHide: true },
    );
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let isSettled = false;
    const timeoutId = setTimeout(() => {
      child.kill("SIGKILL");
      logWarn(editorLogScope, "Audio stream probe timed out", {
        ...createSafePathLogFields(input.ffprobePath, "ffprobe"),
        ...createSafePathLogFields(input.path, "source"),
      });
      settle(false);
    }, input.timeoutMs ?? editorExportFfprobeTimeoutMs);

    const settle = (hasAudio: boolean) => {
      /* v8 ignore next -- Duplicate child-process events after settlement are defensive. */
      if (isSettled) {
        return;
      }

      isSettled = true;
      clearTimeout(timeoutId);
      resolvePromise(hasAudio);
    };

    /* v8 ignore start -- Electron fork coverage does not attribute EventEmitter data callbacks reliably. */
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    /* v8 ignore stop */
    child.on("error", (error) => {
      /* v8 ignore next -- Duplicate events after timeout/error are defensive child-process handling. */
      if (isSettled) {
        return;
      }

      logWarn(editorLogScope, "Audio stream probe failed", {
        error: safeErrorMessage(error),
        ...createSafePathLogFields(input.ffprobePath, "ffprobe"),
        ...createSafePathLogFields(input.path, "source"),
      });
      settle(false);
    });
    child.on("close", (code) => {
      /* v8 ignore next -- Duplicate close after timeout/error is defensive child-process handling. */
      if (isSettled) {
        return;
      }

      if (code === 0) {
        const hasAudio =
          Buffer.concat(stdoutChunks).toString("utf8").trim().length > 0;
        logInfo(editorLogScope, "Audio stream probe completed", {
          hasAudio,
          ...createSafePathLogFields(input.path, "source"),
        });
        settle(hasAudio);
        return;
      }

      logWarn(editorLogScope, "Audio stream probe failed", {
        exitCode: code ?? "unknown",
        error: Buffer.concat(stderrChunks).toString("utf8").slice(-500).trim(),
        ...createSafePathLogFields(input.ffprobePath, "ffprobe"),
        ...createSafePathLogFields(input.path, "source"),
      });
      settle(false);
    });
  });
}

function resolveNoobsBinaryPath(
  binaryName: "ffmpeg" | "ffprobe",
): string | null {
  /* v8 ignore start -- Binary lookup branches depend on OS packaging paths and process.platform. */
  const executableName =
    process.platform === "win32" ? `${binaryName}.exe` : binaryName;
  const configured = process.env.HINEKORA_FFMPEG_PATH?.trim();
  const configuredPath = configured ? resolve(configured) : null;
  const resourcesPath =
    typeof process.resourcesPath === "string" ? process.resourcesPath : null;
  const candidates = [
    configuredPath && binaryName === "ffmpeg" ? configuredPath : null,
    configuredPath && binaryName === "ffprobe"
      ? resolve(dirname(configuredPath), executableName)
      : null,
    resolve(currentDir, "../../node_modules/noobs/dist/bin", executableName),
    resolve(
      process.cwd(),
      "node_modules",
      "noobs",
      "dist",
      "bin",
      executableName,
    ),
    resourcesPath
      ? resolve(
          resourcesPath,
          "node_modules",
          "noobs",
          "dist",
          "bin",
          executableName,
        )
      : null,
    resourcesPath
      ? resolve(
          resourcesPath,
          "app.asar.unpacked",
          "node_modules",
          "noobs",
          "dist",
          "bin",
          executableName,
        )
      : null,
  ].filter((candidate): candidate is string => candidate !== null);

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
  /* v8 ignore stop */
}

function formatFfmpegSeconds(seconds: number): string {
  /* v8 ignore next -- ffmpeg render segments are validated before formatting. */
  if (!Number.isFinite(seconds)) {
    return "0.000";
  }

  return Math.max(0, seconds).toFixed(3);
}

function logEditorBinaryResolution(
  binary: "ffmpeg" | "ffprobe",
  path: string | null,
): void {
  logInfo(editorLogScope, "Editor media binary lookup completed", {
    binary,
    found: path !== null,
    ...createSafePathLogFields(path, binary),
  });
}

export {
  createFfmpegProgressReporter,
  parseFfmpegProgressSeconds,
  probeEditorAudioStream,
  renderEditorExportWithFfmpeg,
  resolveAudioStreamsByPath,
  resolveEditorFfmpegPath,
  runEditorFfmpeg,
};
