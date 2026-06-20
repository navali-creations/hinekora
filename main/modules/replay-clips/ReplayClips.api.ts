import { ipcRenderer } from "electron";

import type { ReplayClip } from "~/types";
import { ReplayClipsChannel } from "./ReplayClips.channels";
import type {
  ReplayClipBatchFileActionResult,
  ReplayClipDetail,
  ReplayClipFileActionResult,
  ReplayClipLibraryPage,
  ReplayClipLibraryQuery,
  ReplayClipListFilter,
} from "./ReplayClips.dto";

interface IpcValidationFailure {
  ok: false;
  error: string;
}

function unwrapReplayClipList(
  result: ReplayClip[] | IpcValidationFailure,
): ReplayClip[] {
  if (Array.isArray(result)) {
    return result;
  }

  throw new Error(result.error);
}

function unwrapIpcResult<T>(result: T | IpcValidationFailure): T {
  if (typeof result === "object" && result !== null) {
    const maybeFailure = result as Partial<IpcValidationFailure>;
    if (maybeFailure.ok === false) {
      throw new Error(maybeFailure.error ?? "Operation failed");
    }
  }

  return result as T;
}

const ReplayClipsAPI = {
  get: async (id: string): Promise<ReplayClipDetail | null> =>
    unwrapIpcResult(await ipcRenderer.invoke(ReplayClipsChannel.Get, id)),
  list: async (filter?: ReplayClipListFilter): Promise<ReplayClip[]> =>
    unwrapReplayClipList(
      await ipcRenderer.invoke(ReplayClipsChannel.List, filter),
    ),
  listLibrary: async (
    query?: ReplayClipLibraryQuery,
  ): Promise<ReplayClipLibraryPage> =>
    unwrapIpcResult(
      await ipcRenderer.invoke(ReplayClipsChannel.ListLibrary, query),
    ),
  saveManual: (): Promise<ReplayClip | null> =>
    ipcRenderer.invoke(ReplayClipsChannel.SaveManual),
  open: (id: string): Promise<ReplayClipFileActionResult> =>
    ipcRenderer.invoke(ReplayClipsChannel.Open, id),
  reveal: (id: string): Promise<ReplayClipFileActionResult> =>
    ipcRenderer.invoke(ReplayClipsChannel.Reveal, id),
  copy: (id: string): Promise<ReplayClipFileActionResult> =>
    ipcRenderer.invoke(ReplayClipsChannel.Copy, id),
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
