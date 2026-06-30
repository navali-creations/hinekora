import { ipcRenderer } from "electron";

import { unwrapIpcResult } from "~/main/utils/ipc-api";

import { SavedEditsChannel } from "./SavedEdits.channels";
import type {
  SavedEditFileActionResult,
  SavedEditsLibraryPage,
  SavedEditsLibraryQuery,
} from "./SavedEdits.dto";

const SavedEditsAPI = {
  delete: (projectId: string): Promise<void> =>
    ipcRenderer
      .invoke(SavedEditsChannel.Delete, projectId)
      .then(unwrapIpcResult),
  deleteAll: (): Promise<void> =>
    ipcRenderer.invoke(SavedEditsChannel.DeleteAll).then(unwrapIpcResult),
  listLibrary: (
    query?: SavedEditsLibraryQuery,
  ): Promise<SavedEditsLibraryPage> =>
    ipcRenderer
      .invoke(SavedEditsChannel.ListLibrary, query)
      .then(unwrapIpcResult),
  revealInExplorer: (projectId: string): Promise<SavedEditFileActionResult> =>
    ipcRenderer
      .invoke(SavedEditsChannel.RevealInExplorer, projectId)
      .then(unwrapIpcResult),
};

export { SavedEditsAPI };
