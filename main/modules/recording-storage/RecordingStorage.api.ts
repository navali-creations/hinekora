import { ipcRenderer } from "electron";

import { RecordingStorageChannel } from "./RecordingStorage.channels";
import type {
  RecordingStorageBatchFileActionResult,
  RecordingStorageFileActionResult,
  RecordingStorageUsage,
  RunRecordingDetail,
  RunRecordingItem,
  RunRecordingLibraryPage,
  RunRecordingLibraryQuery,
} from "./RecordingStorage.dto";

interface IpcValidationFailure {
  ok: false;
  error: string;
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

const RecordingStorageAPI = {
  getRecording: (id: string): Promise<RunRecordingDetail | null> =>
    ipcRenderer
      .invoke(RecordingStorageChannel.GetRecording, id)
      .then(unwrapIpcResult),
  getUsage: (): Promise<RecordingStorageUsage> =>
    ipcRenderer.invoke(RecordingStorageChannel.GetUsage),
  listRecordings: (): Promise<RunRecordingItem[]> =>
    ipcRenderer.invoke(RecordingStorageChannel.ListRecordings),
  listRecordingLibrary: (
    query?: RunRecordingLibraryQuery,
  ): Promise<RunRecordingLibraryPage> =>
    ipcRenderer
      .invoke(RecordingStorageChannel.ListRecordingLibrary, query)
      .then(unwrapIpcResult),
  openRecording: (path: string): Promise<RecordingStorageFileActionResult> =>
    ipcRenderer.invoke(RecordingStorageChannel.OpenRecording, path),
  revealRecording: (path: string): Promise<RecordingStorageFileActionResult> =>
    ipcRenderer.invoke(RecordingStorageChannel.RevealRecording, path),
  copyRecording: (path: string): Promise<RecordingStorageFileActionResult> =>
    ipcRenderer.invoke(RecordingStorageChannel.CopyRecording, path),
  deleteRecording: (path: string): Promise<RecordingStorageFileActionResult> =>
    ipcRenderer.invoke(RecordingStorageChannel.DeleteRecording, path),
  deleteManyRecordings: (
    paths: string[],
  ): Promise<RecordingStorageBatchFileActionResult> =>
    ipcRenderer.invoke(RecordingStorageChannel.DeleteManyRecordings, paths),
};

export { RecordingStorageAPI };
