import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { handleValidationError } from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import { SavedVideosChannel } from "./SavedVideos.channels";
import type {
  SavedVideoFileActionResult,
  SavedVideosLibraryPage,
  SavedVideosLibraryQuery,
} from "./SavedVideos.dto";
import {
  validateSavedVideoId,
  validateSavedVideosLibraryQuery,
} from "./SavedVideos.validation";

interface SavedVideosIpcActions {
  delete: (id: string) => Promise<SavedVideoFileActionResult>;
  listLibrary: (
    query: SavedVideosLibraryQuery,
  ) => Promise<SavedVideosLibraryPage>;
  open: (id: string) => Promise<SavedVideoFileActionResult>;
  reveal: (id: string) => Promise<SavedVideoFileActionResult>;
}

function setupSavedVideosIpcHandlers(actions: SavedVideosIpcActions): void {
  registerGuardedIpcHandler(
    SavedVideosChannel.ListLibrary,
    [WindowName.Main],
    async (_event, query: unknown) => {
      try {
        return await actions.listLibrary(
          validateSavedVideosLibraryQuery(query),
        );
      } catch (error) {
        return handleValidationError(error);
      }
    },
  );
  registerIdHandler(SavedVideosChannel.Delete, actions.delete);
  registerIdHandler(SavedVideosChannel.Open, actions.open);
  registerIdHandler(SavedVideosChannel.Reveal, actions.reveal);
}

function registerIdHandler(
  channel:
    | SavedVideosChannel.Delete
    | SavedVideosChannel.Open
    | SavedVideosChannel.Reveal,
  handler: (id: string) => Promise<SavedVideoFileActionResult>,
): void {
  registerGuardedIpcHandler(
    channel,
    [WindowName.Main],
    async (_event, id: unknown) => {
      try {
        return await handler(validateSavedVideoId(id, channel));
      } catch (error) {
        return handleValidationError(error);
      }
    },
  );
}

export { setupSavedVideosIpcHandlers };
