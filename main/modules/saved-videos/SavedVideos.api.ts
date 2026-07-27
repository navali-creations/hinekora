import { ipcRenderer } from "electron";

import { unwrapIpcResult } from "~/main/utils/ipc-api";

import { SavedVideosChannel } from "./SavedVideos.channels";
import type {
  SavedVideoFileActionResult,
  SavedVideosLibraryPage,
  SavedVideosLibraryQuery,
} from "./SavedVideos.dto";
import {
  SavedVideoFileActionResultSchema,
  SavedVideosLibraryPageSchema,
} from "./SavedVideos.dto";

const SavedVideosAPI = {
  delete: (id: string): Promise<SavedVideoFileActionResult> =>
    ipcRenderer
      .invoke(SavedVideosChannel.Delete, id)
      .then(unwrapIpcResult)
      .then((value) => SavedVideoFileActionResultSchema.parse(value)),
  listLibrary: (
    query?: SavedVideosLibraryQuery,
  ): Promise<SavedVideosLibraryPage> =>
    ipcRenderer
      .invoke(SavedVideosChannel.ListLibrary, query)
      .then(unwrapIpcResult)
      .then((value) => SavedVideosLibraryPageSchema.parse(value)),
  onLibraryChanged: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on(SavedVideosChannel.LibraryChanged, listener);
    return () =>
      ipcRenderer.removeListener(SavedVideosChannel.LibraryChanged, listener);
  },
  open: (id: string): Promise<SavedVideoFileActionResult> =>
    ipcRenderer
      .invoke(SavedVideosChannel.Open, id)
      .then(unwrapIpcResult)
      .then((value) => SavedVideoFileActionResultSchema.parse(value)),
  reveal: (id: string): Promise<SavedVideoFileActionResult> =>
    ipcRenderer
      .invoke(SavedVideosChannel.Reveal, id)
      .then(unwrapIpcResult)
      .then((value) => SavedVideoFileActionResultSchema.parse(value)),
};

export { SavedVideosAPI };
