import { basename } from "node:path";

import { app } from "electron";

import type { EditorExportResolution } from "~/main/modules/editor/Editor.dto";
import {
  createEditorExportSegments,
  type EditorResolvedExportClip,
} from "~/main/modules/editor/Editor.export";
import { renderEditorExportWithFfmpeg } from "~/main/modules/editor/Editor.ffmpeg";
import {
  cleanupEditorClipboardOutputDirectory,
  createEditorClipboardOutputPath,
} from "~/main/modules/editor/Editor.files";
import { createSafePathLogFields, logWarn } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { copyRenderedFileToClipboard } from "~/main/utils/rendered-file-clipboard";

import {
  defaultReplayClipPlaybackRate,
  type ReplayClipPlaybackRate,
} from "~/types";
import type {
  ReplayClipFileActionResult,
  ReplayClipTrimInput,
} from "./ReplayClips.dto";
import { roundReplayClipSeconds } from "./ReplayClips.utils";

interface ReplayClipQuickTrimRenderInput {
  muteAudio?: boolean;
  onProgress?: (progress: number) => void;
  outputPath: string;
  playbackRate?: ReplayClipPlaybackRate;
  queuePolicy?: "preview";
  resolution?: EditorExportResolution;
  sourcePath: string;
  trim: ReplayClipTrimInput;
}

async function renderReplayClipQuickTrim(
  input: ReplayClipQuickTrimRenderInput,
): Promise<void> {
  const trimDurationSeconds = roundReplayClipSeconds(
    input.trim.outSeconds - input.trim.inSeconds,
  );
  const playbackRate = input.playbackRate ?? defaultReplayClipPlaybackRate;
  const outputDurationSeconds = roundReplayClipSeconds(
    trimDurationSeconds / playbackRate,
  );
  const exportClip: EditorResolvedExportClip = {
    durationSeconds: outputDurationSeconds,
    inSeconds: input.trim.inSeconds,
    outSeconds: input.trim.outSeconds,
    playbackRate,
    source: { path: input.sourcePath },
    startSeconds: 0,
  };
  const segments = createEditorExportSegments(
    [exportClip],
    outputDurationSeconds,
  );

  await renderEditorExportWithFfmpeg({
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
    ...(input.muteAudio ? { muteAudio: true } : {}),
    outputPath: input.outputPath,
    ...(input.queuePolicy === "preview"
      ? { queueOptions: { priority: "high" as const, rejectIfBusy: true } }
      : {}),
    resolution: input.resolution ?? "1080p",
    segments,
  });
}

async function copyTrimmedReplayClipToClipboard(input: {
  muteAudio?: boolean;
  onProgress?: (progress: number) => void;
  playbackRate?: ReplayClipPlaybackRate;
  render?: (outputPath: string) => Promise<void>;
  sourcePath: string;
  trim: ReplayClipTrimInput;
}): Promise<ReplayClipFileActionResult> {
  const tempPath = app.getPath("temp");

  return copyRenderedFileToClipboard({
    cleanup: (outputPath) =>
      cleanupEditorClipboardOutputDirectory({
        protectedPath: outputPath,
        tempPath,
      }),
    createOutputPath: () =>
      createEditorClipboardOutputPath({
        fileName: basename(input.sourcePath),
        tempPath,
      }),
    onCleanupError: /* v8 ignore next */ (error, outputPath) => {
      /* v8 ignore next */
      logWarn("replay-clips", "Replay clip clipboard cleanup failed", {
        error: safeErrorMessage(error),
        ...createSafePathLogFields(outputPath, "clipboard"),
      });
    },
    render: (outputPath) =>
      input.render
        ? input.render(outputPath)
        : renderReplayClipQuickTrim({
            ...(input.onProgress ? { onProgress: input.onProgress } : {}),
            ...(input.muteAudio ? { muteAudio: true } : {}),
            ...(input.playbackRate ? { playbackRate: input.playbackRate } : {}),
            outputPath,
            sourcePath: input.sourcePath,
            trim: input.trim,
          }),
  });
}

export type { ReplayClipQuickTrimRenderInput };
export { copyTrimmedReplayClipToClipboard, renderReplayClipQuickTrim };
