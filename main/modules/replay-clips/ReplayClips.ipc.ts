import type { WebContents } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { logWarn } from "~/main/utils/app-log";
import {
  assertString,
  handleValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import type { ReplayClip } from "~/types";
import { ReplayClipsChannel } from "./ReplayClips.channels";
import type {
  ReplayClipBatchFileActionResult,
  ReplayClipCopyInput,
  ReplayClipDetail,
  ReplayClipFileActionResult,
  ReplayClipLibraryPage,
  ReplayClipLibraryQuery,
  ReplayClipOperationProgress,
  ReplayClipUpdateInput,
  ReplayClipUpdateResult,
  ReplayClipView,
} from "./ReplayClips.dto";
import {
  validateReplayClipCopyInput,
  validateReplayClipIdList,
  validateReplayClipLibraryQuery,
  validateReplayClipUpdateInput,
} from "./ReplayClips.validation";

interface ReplayClipsIpcController {
  copyClipToClipboard: (
    input: ReplayClipCopyInput,
    options: { onProgress: (progress: ReplayClipOperationProgress) => void },
  ) => Promise<ReplayClipFileActionResult>;
  createReplayClipView: (clip: ReplayClip) => ReplayClipView;
  deleteClip: (id: string) => Promise<ReplayClipFileActionResult>;
  deleteManyClips: (ids: string[]) => Promise<ReplayClipBatchFileActionResult>;
  getClipView: (id: string) => ReplayClipDetail | null;
  listLibrary: (
    query: ReplayClipLibraryQuery,
  ) => Promise<ReplayClipLibraryPage>;
  openClip: (id: string) => Promise<ReplayClipFileActionResult>;
  revealClip: (id: string) => ReplayClipFileActionResult;
  saveManualReplay: () => Promise<ReplayClip | null>;
  updateClipFile: (
    input: ReplayClipUpdateInput,
    options: { onProgress: (progress: ReplayClipOperationProgress) => void },
  ) => Promise<ReplayClipUpdateResult>;
}

function setupReplayClipsIpcHandlers(
  controller: ReplayClipsIpcController,
): void {
  registerGuardedIpcHandler(
    ReplayClipsChannel.Get,
    [WindowName.Main, WindowName.ClipPreviewOverlay],
    (_event, id: unknown) =>
      handleValidatedId(ReplayClipsChannel.Get, id, controller.getClipView),
  );
  registerGuardedIpcHandler(
    ReplayClipsChannel.ListLibrary,
    [WindowName.Main],
    (_event, query: unknown) => {
      try {
        return controller.listLibrary(validateReplayClipLibraryQuery(query));
      } catch (error) {
        return handleValidationError(error);
      }
    },
  );
  registerGuardedIpcHandler(
    ReplayClipsChannel.SaveManualReplay,
    [WindowName.Main, WindowName.RecorderOverlay],
    async () => {
      const clip = await controller.saveManualReplay();
      return clip ? controller.createReplayClipView(clip) : null;
    },
  );
  registerGuardedIpcHandler(
    ReplayClipsChannel.Update,
    [WindowName.Main, WindowName.ClipPreviewOverlay],
    (event, input: unknown) => {
      try {
        const sender = (event as { sender?: WebContents }).sender;
        return controller.updateClipFile(validateReplayClipUpdateInput(input), {
          onProgress: (progress) => sendOperationProgress(sender, progress),
        });
      } catch (error) {
        return handleValidationError(error);
      }
    },
  );
  registerGuardedIpcHandler(
    ReplayClipsChannel.Open,
    [WindowName.Main],
    (_event, id: unknown) =>
      handleValidatedId(ReplayClipsChannel.Open, id, controller.openClip),
  );
  registerGuardedIpcHandler(
    ReplayClipsChannel.Reveal,
    [WindowName.Main, WindowName.ClipPreviewOverlay],
    (_event, id: unknown) =>
      handleValidatedId(ReplayClipsChannel.Reveal, id, controller.revealClip),
  );
  registerGuardedIpcHandler(
    ReplayClipsChannel.Copy,
    [WindowName.Main, WindowName.ClipPreviewOverlay],
    (event, input: unknown) => {
      try {
        const sender = (event as { sender?: WebContents }).sender;
        return controller.copyClipToClipboard(
          validateReplayClipCopyInput(input),
          {
            onProgress: (progress) => sendOperationProgress(sender, progress),
          },
        );
      } catch (error) {
        return handleValidationError(error);
      }
    },
  );
  registerGuardedIpcHandler(
    ReplayClipsChannel.Delete,
    [WindowName.Main],
    (_event, id: unknown) =>
      handleValidatedId(ReplayClipsChannel.Delete, id, controller.deleteClip),
  );
  registerGuardedIpcHandler(
    ReplayClipsChannel.DeleteMany,
    [WindowName.Main],
    (_event, ids: unknown) => {
      try {
        return controller.deleteManyClips(validateReplayClipIdList(ids));
      } catch (error) {
        return handleValidationError(error);
      }
    },
  );
}

function handleValidatedId<T>(
  channel: ReplayClipsChannel,
  value: unknown,
  operation: (id: string) => T,
): T | ReturnType<typeof handleValidationError> {
  try {
    assertString(value, "id", channel, { min: 1, max: 128 });
    return operation(value);
  } catch (error) {
    return handleValidationError(error);
  }
}

function sendOperationProgress(
  sender: WebContents | undefined,
  progress: ReplayClipOperationProgress,
): void {
  try {
    if (!sender || sender.isDestroyed()) {
      return;
    }
    sender.send(ReplayClipsChannel.OperationProgress, progress);
  } catch (error) {
    logWarn("replay-clips", "Failed to send replay clip progress", {
      error: safeErrorMessage(error),
    });
  }
}

export { setupReplayClipsIpcHandlers };
