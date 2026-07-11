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
  ReplayClipOperationProgress,
  ReplayClipPreviewProgress,
  ReplayClipUpdateInput,
  ReplayClipUpdateResult,
  ReplayClipView,
} from "./ReplayClips.dto";

const ReplayClipsAPI = {
  get: async (id: string): Promise<ReplayClipDetail | null> =>
    unwrapIpcResult(await ipcRenderer.invoke(ReplayClipsChannel.Get, id)),
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
  onPreviewProgress: (
    callback: (progress: ReplayClipPreviewProgress) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: ReplayClipPreviewProgress,
    ) => {
      callback(progress);
    };
    ipcRenderer.on(ReplayClipsChannel.PreviewProgress, listener);

    return () =>
      ipcRenderer.removeListener(ReplayClipsChannel.PreviewProgress, listener);
  },
};

export { ReplayClipsAPI };
