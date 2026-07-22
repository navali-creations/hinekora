import { ipcRenderer } from "electron";

import { unwrapIpcResult } from "~/main/utils/ipc-api";

import { SavedVideosChannel } from "./SavedVideos.channels";
import type {
  SavedVideoFileActionResult,
  SavedVideosLibraryPage,
  SavedVideosLibraryQuery,
} from "./SavedVideos.dto";

const SavedVideosAPI = {
  delete: (id: string): Promise<SavedVideoFileActionResult> =>
    ipcRenderer.invoke(SavedVideosChannel.Delete, id).then(unwrapIpcResult),
  listLibrary: (
    query?: SavedVideosLibraryQuery,
  ): Promise<SavedVideosLibraryPage> =>
    ipcRenderer
      .invoke(SavedVideosChannel.ListLibrary, query)
      .then(unwrapIpcResult),
  open: (id: string): Promise<SavedVideoFileActionResult> =>
    ipcRenderer.invoke(SavedVideosChannel.Open, id).then(unwrapIpcResult),
  reveal: (id: string): Promise<SavedVideoFileActionResult> =>
    ipcRenderer.invoke(SavedVideosChannel.Reveal, id).then(unwrapIpcResult),
};

export { SavedVideosAPI };
