import { ipcRenderer } from "electron";

import { unwrapIpcResult } from "~/main/utils/ipc-api";

import type { ReplayClip } from "~/types";
import { ReplayClipsChannel } from "./ReplayClips.channels";
import type {
  ReplayClipBatchFileActionResult,
  ReplayClipCopyInput,
  ReplayClipDetail,
  ReplayClipFileActionResult,
  ReplayClipLibraryPage,
  ReplayClipLibraryQuery,
  ReplayClipListFilter,
  ReplayClipUpdateInput,
  ReplayClipUpdateResult,
} from "./ReplayClips.dto";

const ReplayClipsAPI = {
  get: async (id: string): Promise<ReplayClipDetail | null> =>
    unwrapIpcResult(await ipcRenderer.invoke(ReplayClipsChannel.Get, id)),
  list: async (filter?: ReplayClipListFilter): Promise<ReplayClip[]> =>
    unwrapIpcResult<ReplayClip[]>(
      await ipcRenderer.invoke(ReplayClipsChannel.List, filter),
    ),
  listLibrary: async (
    query?: ReplayClipLibraryQuery,
  ): Promise<ReplayClipLibraryPage> =>
    unwrapIpcResult(
      await ipcRenderer.invoke(ReplayClipsChannel.ListLibrary, query),
    ),
  saveManualReplay: (): Promise<ReplayClip | null> =>
    ipcRenderer.invoke(ReplayClipsChannel.SaveManualReplay),
  update: (input: ReplayClipUpdateInput): Promise<ReplayClipUpdateResult> =>
    ipcRenderer.invoke(ReplayClipsChannel.Update, input),
  open: (id: string): Promise<ReplayClipFileActionResult> =>
    ipcRenderer.invoke(ReplayClipsChannel.Open, id),
  reveal: (id: string): Promise<ReplayClipFileActionResult> =>
    ipcRenderer.invoke(ReplayClipsChannel.Reveal, id),
  copy: (
    input: string | ReplayClipCopyInput,
  ): Promise<ReplayClipFileActionResult> =>
    ipcRenderer.invoke(ReplayClipsChannel.Copy, input),
  delete: (id: string): Promise<ReplayClipFileActionResult> =>
    ipcRenderer.invoke(ReplayClipsChannel.Delete, id),
  deleteMany: (ids: string[]): Promise<ReplayClipBatchFileActionResult> =>
    ipcRenderer.invoke(ReplayClipsChannel.DeleteMany, ids),
  onStatusChanged: (callback: (clip: ReplayClip) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, clip: ReplayClip) => {
      callback(clip);
    };
    ipcRenderer.on(ReplayClipsChannel.StatusChanged, listener);

    return () =>
      ipcRenderer.removeListener(ReplayClipsChannel.StatusChanged, listener);
  },
};

export { ReplayClipsAPI };
