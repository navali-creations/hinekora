import { ipcRenderer } from "electron";

import { unwrapIpcResult } from "~/main/utils/ipc-api";

import { ReplayClipsChannel } from "./ReplayClips.channels";
import type {
  ReplayClipBatchFileActionResult,
  ReplayClipCopyInput,
  ReplayClipDetail,
  ReplayClipFileActionResult,
  ReplayClipLibraryPage,
  ReplayClipLibraryQuery,
  ReplayClipListFilter,
  ReplayClipOperationProgress,
  ReplayClipUpdateInput,
  ReplayClipUpdateResult,
  ReplayClipView,
} from "./ReplayClips.dto";

const ReplayClipsAPI = {
  get: async (id: string): Promise<ReplayClipDetail | null> =>
    unwrapIpcResult(await ipcRenderer.invoke(ReplayClipsChannel.Get, id)),
  list: async (filter?: ReplayClipListFilter): Promise<ReplayClipView[]> =>
    unwrapIpcResult<ReplayClipView[]>(
      await ipcRenderer.invoke(ReplayClipsChannel.List, filter),
    ),
  listLibrary: async (
    query?: ReplayClipLibraryQuery,
  ): Promise<ReplayClipLibraryPage> =>
    unwrapIpcResult(
      await ipcRenderer.invoke(ReplayClipsChannel.ListLibrary, query),
    ),
  saveManualReplay: (): Promise<ReplayClipView | null> =>
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
  onStatusChanged: (callback: (clip: ReplayClipView) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      clip: ReplayClipView,
    ) => {
      callback(clip);
    };
    ipcRenderer.on(ReplayClipsChannel.StatusChanged, listener);

    return () =>
      ipcRenderer.removeListener(ReplayClipsChannel.StatusChanged, listener);
  },
  onOperationProgress: (
    callback: (progress: ReplayClipOperationProgress) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: ReplayClipOperationProgress,
    ) => {
      callback(progress);
    };
    ipcRenderer.on(ReplayClipsChannel.OperationProgress, listener);

    return () =>
      ipcRenderer.removeListener(
        ReplayClipsChannel.OperationProgress,
        listener,
      );
  },
};

export { ReplayClipsAPI };
